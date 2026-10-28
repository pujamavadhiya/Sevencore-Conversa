from rest_framework import serializers
from django.utils import timezone
from .models import Campaign, CampaignContact
from apps.agents.serializers import VoiceAgentSerializer
from apps.contacts.serializers import ContactSerializer

class CampaignContactSerializer(serializers.ModelSerializer):
    contact = ContactSerializer(read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    followup_status_display = serializers.CharField(source="get_followup_status_display", read_only=True)
    followup_reason_display = serializers.CharField(source="get_followup_reason_display", read_only=True)

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
            "followup_status",
            "followup_status_display",
            "followup_reason",
            "followup_reason_display",
            "followup_round",
            "followup_eligible_at",
            "previous_conversation",
            "sarvam_cohort_id",
            "created_at",
        ]

class CampaignSerializer(serializers.ModelSerializer):
    agent_details = VoiceAgentSerializer(source="agent", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    contacts_count = serializers.IntegerField(source="campaign_contacts.count", read_only=True)
    followups_pending_count = serializers.SerializerMethodField()
    followups_eligible_count = serializers.SerializerMethodField()

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
            "sarvam_campaign_id",
            "followups_queued_count",
            "followups_completed_count",
            "followups_pending_count",
            "followups_eligible_count",
            "contacts_count",
            "started_at",
            "completed_at",
            "created_at",
            "updated_at",
        ]

    def get_followups_pending_count(self, obj) -> int:
        return obj.campaign_contacts.filter(followup_status="followup_pending").count()

    def get_followups_eligible_count(self, obj) -> int:
        now = timezone.now()
        return obj.campaign_contacts.filter(
            followup_status="followup_pending",
            followup_eligible_at__isnull=False,
            followup_eligible_at__lte=now
        ).count()

