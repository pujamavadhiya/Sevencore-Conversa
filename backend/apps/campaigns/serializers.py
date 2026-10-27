from rest_framework import serializers
from .models import Campaign, CampaignContact
from apps.agents.serializers import VoiceAgentSerializer
from apps.contacts.serializers import ContactSerializer

class CampaignContactSerializer(serializers.ModelSerializer):
    contact = ContactSerializer(read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = CampaignContact
        fields = [
            "id",
            "campaign",
            "contact",
            "status",
            "status_display",
            "attempts_count",
            "last_attempt_at",
            "custom_variables",
            "notes",
            "created_at",
        ]

class CampaignSerializer(serializers.ModelSerializer):
    agent_details = VoiceAgentSerializer(source="agent", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    contacts_count = serializers.IntegerField(source="campaign_contacts.count", read_only=True)

    class Meta:
        model = Campaign
        fields = [
            "id",
            "organization",
            "name",
            "description",
            "agent",
            "agent_details",
            "status",
            "status_display",
            "calling_window_start",
            "calling_window_end",
            "scheduled_start_time",
            "calls_per_second",
            "max_retries",
            "retry_interval_minutes",
            "is_confirmed",
            "estimated_cost_inr",
            "actual_cost_inr",
            "total_contacts",
            "calls_attempted",
            "calls_answered",
            "calls_completed",
            "calls_failed",
            "contacts_count",
            "started_at",
            "completed_at",
            "created_at",
            "updated_at",
        ]
