import logging
import datetime
from decimal import Decimal
from typing import Dict, Any
from django.utils import timezone
from django.conf import settings
from apps.campaigns.models import Campaign, CampaignContact
from apps.calls.models import CallAttempt, CallEvent, Transcript
from apps.contacts.models import SuppressionEntry
from integrations.sarvam.factory import get_sarvam_client
from integrations.sarvam.compliance import is_within_permitted_calling_hours, check_number_compliance

logger = logging.getLogger(__name__)

class CampaignExecutionEngine:
    """
    Campaign Orchestration Engine.
    Handles contact filtering, DND suppression, pacing, Sarvam API dispatch,
    idempotent call attempt tracking, and cost calculation.
    """

    @classmethod
    def validate_and_start(cls, campaign: Campaign, bypass_hours_check: bool = False) -> Dict[str, Any]:
        if not campaign.is_confirmed:
            return {
                "success": False,
                "error": "Campaign cannot start: Explicit user launch confirmation is required.",
            }

        # Enforce TRAI commercial calling hours unless explicitly bypassed (e.g. in test or opt-in transactional)
        if not bypass_hours_check and campaign.organization.compliance_mode:
            allowed, reason = is_within_permitted_calling_hours(
                campaign.calling_window_start.hour,
                campaign.calling_window_end.hour,
            )
            if not allowed:
                return {
                    "success": False,
                    "error": f"Compliance Error: {reason}",
                }

        # Check budget guardrail
        if campaign.organization.max_daily_budget_inr > 0:
            if campaign.actual_cost_inr >= campaign.organization.max_daily_budget_inr:
                return {
                    "success": False,
                    "error": f"Daily organization budget limit (₹{campaign.organization.max_daily_budget_inr}) reached.",
                }

        campaign.status = "running"
        campaign.started_at = timezone.now()
        campaign.save()

        # Run dispatch for pending contacts
        return cls.dispatch_pending_batch(campaign)

    @classmethod
    def dispatch_pending_batch(cls, campaign: Campaign, batch_size: int = 50) -> Dict[str, Any]:
        client = get_sarvam_client()
        connection_id = getattr(settings, "SARVAM_CONNECTION_ID", "conn_sarvam_rented")
        agent_number = getattr(settings, "SARVAM_AGENT_PHONE_NUMBER", "+918040001234")
        backend_url = getattr(settings, "BACKEND_PUBLIC_URL", "http://localhost:8000")
        webhook_url = f"{backend_url.rstrip('/')}/api/v1/webhooks/sarvam/"

        pending_items = campaign.campaign_contacts.filter(status="pending")[:batch_size]
        
        dispatched_count = 0
        suppressed_count = 0
        errors = []

        for item in pending_items:
            phone = item.contact.phone_number
            is_eligible, reason = check_number_compliance(campaign.organization, phone)
            
            if not is_eligible:
                item.status = "skipped_dnd"
                item.notes = reason
                item.save()
                suppressed_count += 1
                continue

            # Idempotency check: don't call if active CallAttempt already exists for this contact in this campaign
            existing = CallAttempt.objects.filter(campaign_contact=item, status__in=["initiated", "connected"]).exists()
            if existing:
                continue

            # Create internal call attempt record before network call
            attempt = CallAttempt.objects.create(
                organization=campaign.organization,
                campaign=campaign,
                campaign_contact=item,
                contact=item.contact,
                agent=campaign.agent,
                user_phone_number=phone,
                agent_phone_number=agent_number,
                status="initiated",
                is_mock=client.is_mock,
            )

            # Metadata passed to Sarvam webhook for correlation
            webhook_metadata = {
                "campaign_id": campaign.id,
                "campaign_contact_id": item.id,
                "call_attempt_id": attempt.id,
                "internal_uuid": str(attempt.internal_uuid),
            }

            # Assemble Knowledge Base Context for Agent Learning & Execution
            kb_files = campaign.agent.knowledge_files.filter(status="attached")
            kb_context = "\n".join([f"[{f.name}]: {f.content_summary}" for f in kb_files if f.content_summary])
            
            merged_variables = dict(item.custom_variables or {})
            merged_variables["agent_name"] = campaign.agent.name
            merged_variables["speaker"] = campaign.agent.speaker
            merged_variables["turn_timeout_seconds"] = campaign.agent.turn_timeout_seconds
            merged_variables["max_duration_seconds"] = campaign.agent.max_conversation_duration_seconds
            merged_variables["system_instructions"] = campaign.agent.system_instructions
            if kb_context:
                merged_variables["knowledge_base_context"] = kb_context

            resp = client.initiate_outbound_call(
                app_id=campaign.agent.sarvam_app_id or getattr(settings, "SARVAM_DEFAULT_APP_ID", "app_agent_1"),
                app_version=campaign.agent.sarvam_app_version,
                connection_id=connection_id,
                agent_phone_number=agent_number,
                user_phone_number=phone,
                agent_variables=merged_variables,
                initial_bot_message=campaign.agent.greeting_message,
                initial_language_name=campaign.agent.primary_language,
                webhook_url=webhook_url,
                webhook_metadata=webhook_metadata,
            )

            if resp.get("success"):
                attempt.sarvam_attempt_id = resp.get("attempt_id", "")
                attempt.save()
                
                CallEvent.objects.create(
                    call_attempt=attempt,
                    event_type="initiated",
                    payload=resp.get("raw_response", {}),
                )

                item.status = "calling"
                item.attempts_count += 1
                item.last_attempt_at = timezone.now()
                item.save()
                dispatched_count += 1

                # If mock provider, simulate call progression immediately for realistic testing
                if client.is_mock:
                    cls._simulate_mock_completion(client, attempt, item)
            else:
                err_msg = resp.get("error", "Unknown provider error")
                attempt.status = "failed"
                attempt.failure_reason = err_msg
                attempt.save()

                item.status = "failed"
                item.notes = err_msg
                item.save()
                errors.append(f"{phone}: {err_msg}")

        # Update campaign metrics
        cls.recalculate_campaign_metrics(campaign)

        return {
            "success": True,
            "dispatched_count": dispatched_count,
            "suppressed_count": suppressed_count,
            "errors": errors,
            "campaign_status": campaign.status,
            "is_mock": client.is_mock,
        }

    @classmethod
    def _simulate_mock_completion(cls, mock_client, attempt: CallAttempt, item: CampaignContact):
        """Executes full simulation lifecycle for mock calls."""
        sim = mock_client.simulate_call_completion(
            attempt_id=attempt.sarvam_attempt_id,
            contact_name=item.contact.name,
            language=attempt.agent.primary_language,
            purpose=attempt.agent.purpose,
        )

        attempt.status = sim["status"]
        attempt.duration_seconds = sim["duration"]
        attempt.interaction_id = sim.get("interaction_id") or ""
        attempt.failure_reason = sim.get("failure_reason") or ""
        attempt.final_agent_variables = sim.get("final_agent_variables") or {}
        attempt.calculate_cost()
        attempt.save()

        CallEvent.objects.create(
            call_attempt=attempt,
            event_type="webhook_received",
            payload=sim,
        )

        # Store Transcript
        if sim.get("messages"):
            Transcript.objects.update_or_create(
                call_attempt=attempt,
                defaults={
                    "messages": sim["messages"],
                    "summary": sim["summary"],
                    "disposition": sim["disposition"],
                    "sentiment": "Positive" if "Interested" in sim["disposition"] else "Neutral",
                }
            )

        # Update CampaignContact
        if sim["status"] == "connected":
            item.status = "connected"
        elif sim["status"] == "no_answer":
            item.status = "no_answer"
        elif sim["status"] == "busy":
            item.status = "busy"
        else:
            item.status = "failed"
        item.notes = sim["summary"]
        item.save()

        # Process smart follow-up classification
        cls.process_contact_followup_outcome(item, sim)

    # -------------------------------------------------------------------------
    # Sarvam Batch Follow-up Classification & Cohort Engine
    # -------------------------------------------------------------------------
    MAX_FOLLOWUP_ROUNDS = 2
    TRANSCRIPT_MAX_CHARS = 1500

    FOLLOWUP_DELAY_HOURS = {
        "no_answer_retries_exhausted": 24,
        "busy_retries_exhausted": 6,
        "silent_after_pickup_10s": 3,
        "silent_mid_conversation_10s": 2,      # Engaged but dropped; call back sooner
        "connected_but_no_conclusion": 3,
        "call_failed": 1,
    }

    @classmethod
    def classify_call_outcome(cls, payload: Dict[str, Any]) -> tuple[str, str | None]:
        """
        Pure function: Maps one webhook/attempt payload to (followup_status, followup_reason).
        Covers:
          1) Not answered / busy -> platform retries; if exhausted -> follow-up batch
          2) Answered, silent 10s -> agent hangs up -> follow-up with reason
          3) Silent 10s mid-talk -> agent hangs up -> follow-up with conversation + reason
          4) Interacted, concluded -> agent ends call -> SUCCESS, conversation stored
        """
        connectivity = payload.get("connectivity_status") or payload.get("status")
        connected = connectivity == "connected"
        vars_ = payload.get("final_agent_variables") or {}
        outcome = vars_.get("call_outcome")
        completion = payload.get("completion_status")

        if not connected:
            if payload.get("next_action_status") == "retry":
                return "retrying", None
            if completion == "failed" and payload.get("failure_reason"):
                return "followup_pending", "call_failed"
            reason = "busy_retries_exhausted" if connectivity == "busy" else "no_answer_retries_exhausted"
            return "followup_pending", reason

        # Connected calls
        if outcome == "success" or completion == "completed":
            return "success", None
        if outcome == "silent_after_pickup":
            return "followup_pending", "silent_after_pickup_10s"
        if outcome == "silent_mid_conversation":
            return "followup_pending", "silent_mid_conversation_10s"

        # Connected, but call ended without agent conclusion
        return "followup_pending", "connected_but_no_conclusion"

    @classmethod
    def process_contact_followup_outcome(cls, item: CampaignContact, payload: Dict[str, Any]):
        """Updates contact follow-up state machine based on Sarvam call outcome."""
        status_val, reason_val = cls.classify_call_outcome(payload)

        # Extract transcript text snippet if available
        transcript_snippet = ""
        raw_turns = payload.get("interaction_transcript") or payload.get("messages") or []
        if isinstance(raw_turns, list):
            lines = []
            for t in raw_turns:
                role = t.get("role", "speaker")
                content = t.get("content") or t.get("en_text") or t.get("text") or ""
                if content:
                    lines.append(f"{role}: {content}")
            transcript_snippet = "\n".join(lines)[-cls.TRANSCRIPT_MAX_CHARS:]

        if transcript_snippet:
            item.previous_conversation = transcript_snippet

        if status_val == "retrying":
            item.followup_status = "retrying"
        elif status_val == "success":
            item.followup_status = "success"
            item.followup_reason = None
            if item.campaign:
                item.campaign.followups_completed_count += 1
                item.campaign.save()
        else:
            item.followup_reason = reason_val
            if item.followup_round >= cls.MAX_FOLLOWUP_ROUNDS:
                item.followup_status = "given_up"
            else:
                item.followup_status = "followup_pending"
                delay_hours = cls.FOLLOWUP_DELAY_HOURS.get(reason_val, 3)
                item.followup_eligible_at = timezone.now() + datetime.timedelta(hours=delay_hours)

        item.save()

    @classmethod
    def dispatch_followup_cohort(cls, campaign: Campaign, batch_label: str | None = None) -> Dict[str, Any]:
        """
        Dispatches all eligible follow-up contacts into the same campaign as a new cohort.
        Injects app_variables: followup_reason, followup_round, and previous_conversation
        so the agent smoothly picks up the conversation context.
        """
        now = timezone.now()
        due_contacts = campaign.campaign_contacts.filter(
            followup_status="followup_pending",
            followup_eligible_at__isnull=False,
            followup_eligible_at__lte=now
        ).select_related("contact")

        if not due_contacts.exists():
            return {
                "success": True,
                "queued": 0,
                "message": "No follow-up contacts are currently eligible for dispatch.",
            }

        client = get_sarvam_client()
        users = []
        for item in due_contacts:
            users.append({
                "user_phone_number": item.contact.phone_number,
                "user_identifier": f"campaign_{campaign.id}_contact_{item.id}",
                "app_variables": {
                    "followup_reason": item.followup_reason or "",
                    "followup_round": str(item.followup_round + 1),
                    "previous_conversation": (item.previous_conversation or "")[-cls.TRANSCRIPT_MAX_CHARS:],
                },
            })

        label = batch_label or f"followup-c{campaign.id}-{now.strftime('%Y%m%d-%H%M')}"
        sarvam_camp_id = campaign.sarvam_campaign_id or f"camp_{campaign.id}"

        cohort_resp = client.stream_cohort(
            campaign_id=sarvam_camp_id,
            cohort_name=label,
            users=users,
        )

        cohort_ids = cohort_resp.get("cohort_ids", [])
        cohort_id_str = cohort_ids[0] if cohort_ids else "cohort_batch"

        # Update contact states
        count = 0
        for item in due_contacts:
            item.followup_status = "followup_queued"
            item.followup_round += 1
            item.sarvam_cohort_id = cohort_id_str
            item.save()
            count += 1

        campaign.followups_queued_count += count
        campaign.save()

        logger.info("Dispatched %d follow-ups for campaign %s in cohort %s", count, campaign.id, label)

        return {
            "success": True,
            "queued": count,
            "cohort_label": label,
            "cohort_ids": cohort_ids,
            "is_mock": client.is_mock,
        }

    @classmethod
    def recalculate_campaign_metrics(cls, campaign: Campaign):
        total = campaign.campaign_contacts.count()
        answered = campaign.campaign_contacts.filter(status="connected").count()
        failed = campaign.campaign_contacts.filter(status__in=["failed", "no_answer", "busy"]).count()
        pending = campaign.campaign_contacts.filter(status__in=["pending", "calling"]).count()
        attempted = total - pending

        # Sum cost of call attempts
        total_cost = sum(
            attempt.cost_inr for attempt in campaign.call_attempts.all()
        )

        campaign.total_contacts = total
        campaign.calls_attempted = attempted
        campaign.calls_answered = answered
        campaign.calls_completed = answered
        campaign.calls_failed = failed
        campaign.actual_cost_inr = total_cost

        if pending == 0 and total > 0:
            campaign.status = "completed"
            campaign.completed_at = timezone.now()

        campaign.save()
