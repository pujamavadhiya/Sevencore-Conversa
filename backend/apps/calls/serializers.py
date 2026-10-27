from rest_framework import serializers
from .models import CallAttempt, CallEvent, Transcript

class TranscriptSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transcript
        fields = [
            "id",
            "call_attempt",
            "messages",
            "summary",
            "disposition",
            "sentiment",
            "created_at",
        ]

class CallEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = CallEvent
        fields = ["id", "call_attempt", "event_type", "payload", "created_at"]

class CallAttemptSerializer(serializers.ModelSerializer):
    contact_name = serializers.CharField(source="contact.name", read_only=True)
    agent_name = serializers.CharField(source="agent.name", read_only=True)
    campaign_name = serializers.CharField(source="campaign.name", read_only=True, default="")
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    transcript = TranscriptSerializer(read_only=True)
    
    # Mask phone number for non-admin viewers: +91 98765 XXX10
    masked_phone_number = serializers.SerializerMethodField()

    class Meta:
        model = CallAttempt
        fields = [
            "id",
            "internal_uuid",
            "sarvam_attempt_id",
            "interaction_id",
            "organization",
            "campaign",
            "campaign_name",
            "contact",
            "contact_name",
            "agent",
            "agent_name",
            "user_phone_number",
            "masked_phone_number",
            "agent_phone_number",
            "status",
            "status_display",
            "duration_seconds",
            "cost_inr",
            "failure_reason",
            "final_agent_variables",
            "is_mock",
            "transcript",
            "created_at",
            "updated_at",
        ]

    def get_masked_phone_number(self, obj):
        p = obj.user_phone_number
        if len(p) >= 10:
            return p[:6] + "XXXX" + p[-3:]
        return p
