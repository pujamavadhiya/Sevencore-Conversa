import logging
from decimal import Decimal
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from .models import CallAttempt, CallEvent, Transcript
from apps.contacts.models import SuppressionEntry

logger = logging.getLogger(__name__)

class SarvamWebhookView(APIView):
    """
    Idempotent Webhook receiver for Sarvam Voice Agents call completion events.
    Matches official Sarvam POST schema:
    attempt_id, status, channel_info, duration, interaction_id, failure_reason,
    final_agent_variables, webhook_config, interaction_transcript.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        payload = request.data
        if not payload or not isinstance(payload, dict):
            return Response({"error": "Invalid JSON payload"}, status=status.HTTP_400_BAD_REQUEST)

        sarvam_attempt_id = payload.get("attempt_id")
        webhook_config = payload.get("webhook_config") or {}
        metadata = webhook_config.get("metadata") or {}
        internal_call_attempt_id = metadata.get("call_attempt_id")

        logger.info("Received Sarvam webhook for attempt_id: %s (internal_id: %s)", sarvam_attempt_id, internal_call_attempt_id)

        # Ingest into unified separated history pipeline
        try:
            from sarvam_history import ingest_webhook
            ingest_webhook(payload)
        except Exception as exc:
            logger.warning("History ingest_webhook exception: %s", exc)

        # Correlate CallAttempt
        attempt = None
        if internal_call_attempt_id:
            attempt = CallAttempt.objects.filter(id=internal_call_attempt_id).first()
        if not attempt and sarvam_attempt_id:
            attempt = CallAttempt.objects.filter(sarvam_attempt_id=sarvam_attempt_id).first()

        if not attempt:
            logger.warning("Sarvam webhook could not find matching CallAttempt for attempt_id: %s", sarvam_attempt_id)
            return Response({"received": True, "warning": "Unmatched call attempt"}, status=status.HTTP_200_OK)

        # Idempotency check: If this exact webhook payload has already been logged, do not double-process
        already_processed = CallEvent.objects.filter(
            call_attempt=attempt,
            event_type="webhook_received",
            payload__interaction_id=payload.get("interaction_id")
        ).exists() if payload.get("interaction_id") else False

        if already_processed:
            logger.info("Duplicate webhook received for attempt %s, acknowledging idempotently.", attempt.id)
            return Response({"received": True, "status": "duplicate_ignored"}, status=status.HTTP_200_OK)

        # Record audit event
        CallEvent.objects.create(
            call_attempt=attempt,
            event_type="webhook_received",
            payload=payload,
        )

        call_status = payload.get("status", "failed")
        duration = payload.get("duration")
        duration_seconds = float(duration) if duration is not None else 0.0
        interaction_id = payload.get("interaction_id") or ""
        failure_reason = payload.get("failure_reason") or ""
        final_variables = payload.get("final_agent_variables") or {}
        raw_transcript = payload.get("interaction_transcript") or []

        # Update attempt fields
        attempt.status = call_status
        attempt.duration_seconds = duration_seconds
        attempt.interaction_id = interaction_id
        attempt.failure_reason = failure_reason
        attempt.final_agent_variables = final_variables
        attempt.calculate_cost()
        attempt.save()

        # Update CampaignContact if linked
        if attempt.campaign_contact:
            item = attempt.campaign_contact
            if call_status == "connected":
                item.status = "connected"
            elif call_status == "no_answer":
                item.status = "no_answer"
            elif call_status == "busy":
                item.status = "busy"
            else:
                item.status = "failed"
            item.notes = failure_reason or "Call completed"
            item.save()

            # Execute Sarvam smart follow-up state classification
            from apps.campaigns.engine import CampaignExecutionEngine
            CampaignExecutionEngine.process_contact_followup_outcome(item, payload)

        # If call failed because of TRAI NDNC, auto-record in SuppressionEntry
        if failure_reason and "NDNC" in failure_reason.upper():
            SuppressionEntry.objects.get_or_create(
                organization=attempt.organization,
                phone_number=attempt.user_phone_number,
                defaults={"reason": "TRAI_NDNC", "notes": failure_reason}
            )

        # Store turn-by-turn transcript if present
        if raw_transcript:
            formatted_messages = []
            for idx, turn in enumerate(raw_transcript, start=1):
                role = "assistant" if turn.get("role") in ("agent", "assistant") else "user"
                text = turn.get("en_text") or turn.get("content") or ""
                formatted_messages.append({
                    "turn_id": idx,
                    "role": role,
                    "content": text,
                    "language_name": "English",
                })

            summary = f"Call completed with status: {call_status}. Total duration: {duration_seconds}s."
            disposition = "Connected & Spoke" if call_status == "connected" else call_status.title()

            Transcript.objects.update_or_create(
                call_attempt=attempt,
                defaults={
                    "messages": formatted_messages,
                    "summary": summary,
                    "disposition": disposition,
                    "sentiment": "Neutral",
                }
            )

        # If campaign was involved, recalculate campaign metrics
        if attempt.campaign:
            from apps.campaigns.engine import CampaignExecutionEngine
            CampaignExecutionEngine.recalculate_campaign_metrics(attempt.campaign)

        return Response({"received": True, "call_attempt_id": attempt.id, "status": call_status}, status=status.HTTP_200_OK)
