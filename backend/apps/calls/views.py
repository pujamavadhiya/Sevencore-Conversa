import csv
from django.http import HttpResponse
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import CallAttempt, Transcript
from .serializers import CallAttemptSerializer, TranscriptSerializer
from apps.contacts.models import Contact
from apps.agents.models import VoiceAgent
from apps.organizations.models import Organization
from integrations.sarvam.factory import get_sarvam_client
from integrations.sarvam.compliance import check_number_compliance
from apps.calls.webhook import SarvamWebhookView

class CallAttemptViewSet(viewsets.ModelViewSet):
    queryset = CallAttempt.objects.all().select_related("contact", "agent", "campaign", "transcript").order_by("-created_at")
    serializer_class = CallAttemptSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)
        campaign_id = self.request.query_params.get("campaign")
        if campaign_id:
            qs = qs.filter(campaign_id=campaign_id)
        agent_id = self.request.query_params.get("agent")
        if agent_id:
            qs = qs.filter(agent_id=agent_id)
        search = self.request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(contact__name__icontains=search) | qs.filter(user_phone_number__icontains=search)
        return qs

    @action(detail=False, methods=["post"])
    def test_call(self, request):
        """
        Dispatches a controlled single test call to evaluate voice agent persona and audio flow.
        """
        phone_number = request.data.get("phone_number", "").strip()
        agent_id = request.data.get("agent_id")
        contact_name = request.data.get("contact_name", "Test User")
        bypass_compliance = request.data.get("bypass_compliance", False)

        if not phone_number:
            return Response({"error": "Phone number is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not agent_id:
            return Response({"error": "Agent selection is required."}, status=status.HTTP_400_BAD_REQUEST)

        agent = VoiceAgent.objects.filter(id=agent_id).first()
        if not agent:
            return Response({"error": "Selected Voice Agent not found."}, status=status.HTTP_404_NOT_FOUND)

        org = Organization.objects.first()

        # Check telecom compliance unless testing user's own verified number
        if not bypass_compliance:
            is_valid, reason = check_number_compliance(org, phone_number)
            if not is_valid:
                return Response({"error": f"Compliance Error: {reason}"}, status=status.HTTP_400_BAD_REQUEST)

        # Get or create contact
        contact, _ = Contact.objects.get_or_create(
            organization=org,
            phone_number=phone_number,
            defaults={"name": contact_name, "company": "Test Recipient"}
        )

        client = get_sarvam_client()
        attempt = CallAttempt.objects.create(
            organization=org,
            contact=contact,
            agent=agent,
            user_phone_number=phone_number,
            agent_phone_number="+918040001234",
            status="initiated",
            is_mock=client.is_mock,
        )

        # Assemble Knowledge Base Context for Agent Learning & Execution
        kb_files = agent.knowledge_files.filter(status="attached")
        kb_context = "\n".join([f"[{f.name}]: {f.content_summary}" for f in kb_files if f.content_summary])
        agent_variables = {
            "contact_name": contact_name,
            "agent_name": agent.name,
            "speaker": agent.speaker,
            "turn_timeout_seconds": agent.turn_timeout_seconds,
            "max_duration_seconds": agent.max_conversation_duration_seconds,
            "system_instructions": agent.system_instructions,
        }
        if kb_context:
            agent_variables["knowledge_base_context"] = kb_context

        resp = client.initiate_outbound_call(
            app_id=agent.sarvam_app_id or "app_agent_1",
            app_version=agent.sarvam_app_version,
            connection_id="conn_sarvam_rented",
            agent_phone_number="+918040001234",
            user_phone_number=phone_number,
            agent_variables=agent_variables,
            initial_bot_message=agent.greeting_message,
            initial_language_name=agent.primary_language,
        )

        if resp.get("success"):
            attempt.sarvam_attempt_id = resp.get("attempt_id", "")
            attempt.save()

            if client.is_mock:
                # Run immediate mock simulation for test call
                from apps.campaigns.engine import CampaignExecutionEngine
                sim = client.simulate_call_completion(
                    attempt_id=attempt.sarvam_attempt_id,
                    contact_name=contact.name,
                    language=agent.primary_language,
                    purpose=agent.purpose,
                )
                attempt.status = sim["status"]
                attempt.duration_seconds = sim["duration"]
                attempt.interaction_id = sim.get("interaction_id") or ""
                attempt.calculate_cost()
                attempt.save()

                if sim.get("messages"):
                    Transcript.objects.create(
                        call_attempt=attempt,
                        messages=sim["messages"],
                        summary=sim["summary"],
                        disposition=sim["disposition"],
                        sentiment="Positive",
                    )

            return Response(CallAttemptSerializer(attempt).data, status=status.HTTP_201_CREATED)
        else:
            attempt.status = "failed"
            attempt.failure_reason = resp.get("error", "Failed")
            attempt.save()
            return Response({"error": resp.get("error")}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["get"])
    def export_csv(self, request):
        """Exports call history to CSV."""
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="call_history_export.csv"'
        writer = csv.writer(response)
        writer.writerow(["ID", "Contact Name", "Phone Number", "Agent", "Campaign", "Status", "Duration (s)", "Cost (INR)", "Is Mock", "Created At"])
        for c in CallAttempt.objects.all().select_related("contact", "agent", "campaign"):
            writer.writerow([
                c.id,
                c.contact.name if c.contact else "",
                c.user_phone_number,
                c.agent.name if c.agent else "",
                c.campaign.name if c.campaign else "Direct Call",
                c.status,
                c.duration_seconds,
                c.cost_inr,
                c.is_mock,
                c.created_at,
            ])
        return response


class TranscriptViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Transcript.objects.all().select_related("call_attempt", "call_attempt__contact", "call_attempt__agent").order_by("-created_at")
    serializer_class = TranscriptSerializer
    permission_classes = [permissions.AllowAny]
