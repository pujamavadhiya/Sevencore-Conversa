import uuid
from decimal import Decimal
from django.db import models
from apps.organizations.models import Organization
from apps.agents.models import VoiceAgent
from apps.contacts.models import Contact
from apps.campaigns.models import Campaign, CampaignContact

class CallAttempt(models.Model):
    STATUS_CHOICES = (
        ("initiated", "Call Initiated"),
        ("connected", "Connected & Finished"),
        ("no_answer", "No Answer / Ring Timeout"),
        ("busy", "User Busy"),
        ("failed", "Failed / Telecom Error"),
    )

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="call_attempts")
    campaign = models.ForeignKey(Campaign, on_delete=models.SET_NULL, null=True, blank=True, related_name="call_attempts")
    campaign_contact = models.ForeignKey(CampaignContact, on_delete=models.SET_NULL, null=True, blank=True, related_name="call_attempts")
    contact = models.ForeignKey(Contact, on_delete=models.CASCADE, related_name="call_attempts")
    agent = models.ForeignKey(VoiceAgent, on_delete=models.PROTECT, related_name="call_attempts")
    
    # Unique internal idempotency token
    internal_uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    
    # Sarvam Provider References
    sarvam_attempt_id = models.CharField(max_length=128, blank=True, default="", db_index=True)
    interaction_id = models.CharField(max_length=128, blank=True, default="", db_index=True)
    
    # Telephony metadata
    agent_phone_number = models.CharField(max_length=32, blank=True, default="")
    user_phone_number = models.CharField(max_length=32)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default="initiated", db_index=True)
    duration_seconds = models.FloatField(default=0.0)
    cost_inr = models.DecimalField(max_digits=10, decimal_places=4, default=Decimal("0.0000"))
    failure_reason = models.TextField(blank=True, default="")
    final_agent_variables = models.JSONField(default=dict, blank=True)
    
    # Transparency & Mock Flag (Crucial requirement: Mock calls must never masquerade as real)
    is_mock = models.BooleanField(
        default=False,
        help_text="Visible flag: True if simulated by mock provider, False for real Sarvam calls"
    )
    
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def calculate_cost(self, rate_per_min_inr: float = 3.50):
        if self.duration_seconds > 0:
            # Pro-rated to seconds: (seconds / 60) * rate
            minutes = Decimal(str(self.duration_seconds)) / Decimal("60.0")
            self.cost_inr = round(minutes * Decimal(str(rate_per_min_inr)), 4)
        else:
            self.cost_inr = Decimal("0.0000")

    def __str__(self):
        mode = "[MOCK] " if self.is_mock else ""
        return f"{mode}Call to {self.user_phone_number} ({self.status}) - {self.duration_seconds}s"


class CallEvent(models.Model):
    """
    Immutable audit log for call state transitions and webhook deliveries.
    """
    call_attempt = models.ForeignKey(CallAttempt, on_delete=models.CASCADE, related_name="events")
    event_type = models.CharField(max_length=64)
    payload = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.call_attempt.internal_uuid} -> {self.event_type} @ {self.created_at}"


class Transcript(models.Model):
    """
    Conversation transcript and AI disposition.
    """
    call_attempt = models.OneToOneField(CallAttempt, on_delete=models.CASCADE, related_name="transcript")
    messages = models.JSONField(
        default=list,
        help_text="List of turns: [{'turn_id': int, 'role': 'assistant'|'user', 'content': str, 'language_name': str}]"
    )
    summary = models.TextField(blank=True, default="", help_text="AI-generated call outcome summary")
    disposition = models.CharField(max_length=128, blank=True, default="Pending Review")
    sentiment = models.CharField(max_length=64, blank=True, default="Neutral")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Transcript for Call {self.call_attempt_id} ({len(self.messages)} turns)"
