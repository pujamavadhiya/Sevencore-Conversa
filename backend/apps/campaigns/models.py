import datetime
from django.db import models
from apps.organizations.models import Organization
from apps.agents.models import VoiceAgent
from apps.contacts.models import Contact

class Campaign(models.Model):
    STATUS_CHOICES = (
        ("draft", "Draft"),
        ("scheduled", "Scheduled"),
        ("running", "Running"),
        ("paused", "Paused"),
        ("completed", "Completed"),
        ("cancelled", "Cancelled"),
    )

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="campaigns")
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    agent = models.ForeignKey(VoiceAgent, on_delete=models.PROTECT, related_name="campaigns")
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default="draft")
    
    # Timing & Indian Telecom Compliance
    calling_window_start = models.TimeField(
        default=datetime.time(9, 0),
        help_text="Earliest calling time in IST (Default 09:00 AM)"
    )
    calling_window_end = models.TimeField(
        default=datetime.time(20, 0),
        help_text="Latest calling time in IST (Default 08:00 PM TRAI limit)"
    )
    scheduled_start_time = models.DateTimeField(null=True, blank=True)
    
    # Pacing & Concurrency Controls
    calls_per_second = models.PositiveIntegerField(
        default=2,
        help_text="Call dispatch rate (CPS) to avoid telecom congestion"
    )
    max_retries = models.PositiveIntegerField(
        default=2,
        help_text="Maximum retry attempts for unanswered or busy calls"
    )
    retry_interval_minutes = models.PositiveIntegerField(
        default=30,
        help_text="Minutes to wait before retrying unanswered calls"
    )
    
    # Safety & Confirmation Guards
    is_confirmed = models.BooleanField(
        default=False,
        help_text="Explicit user confirmation required before any call can be dispatched"
    )
    estimated_cost_inr = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    actual_cost_inr = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    
    # Metrics Cache
    total_contacts = models.PositiveIntegerField(default=0)
    calls_attempted = models.PositiveIntegerField(default=0)
    calls_answered = models.PositiveIntegerField(default=0)
    calls_completed = models.PositiveIntegerField(default=0)
    calls_failed = models.PositiveIntegerField(default=0)

    # Sarvam Batch Scheduling & Follow-up Tracking
    sarvam_campaign_id = models.CharField(max_length=128, blank=True, default="", help_text="Sarvam Scheduling API Campaign ID")
    followups_queued_count = models.PositiveIntegerField(default=0, help_text="Number of follow-up calls queued into follow-up cohorts")
    followups_completed_count = models.PositiveIntegerField(default=0, help_text="Number of follow-up calls completed")
    
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.status})"


class CampaignContact(models.Model):
    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("calling", "Calling in Progress"),
        ("connected", "Connected & Finished"),
        ("no_answer", "No Answer"),
        ("busy", "Line Busy"),
        ("failed", "Failed"),
        ("skipped_dnd", "Skipped (DND/Suppression)"),
        ("skipped_optout", "Skipped (Opt-out)"),
    )

    FOLLOWUP_STATUS_CHOICES = (
        ("pending", "Pending Initial Call"),
        ("success", "Interacted & Concluded"),
        ("retrying", "Platform Retrying"),
        ("followup_pending", "Follow-up Pending"),
        ("followup_queued", "Follow-up Queued in Cohort"),
        ("given_up", "Max Follow-ups Given Up"),
    )

    FOLLOWUP_REASON_CHOICES = (
        ("no_answer_retries_exhausted", "No Answer (Retries Exhausted)"),
        ("busy_retries_exhausted", "Busy (Retries Exhausted)"),
        ("silent_after_pickup_10s", "Answered, Silent 10s After Pickup"),
        ("silent_mid_conversation_10s", "Silent 10s Mid-Talk"),
        ("connected_but_no_conclusion", "Connected But No Conclusion"),
        ("call_failed", "Call Failed"),
    )

    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name="campaign_contacts")
    contact = models.ForeignKey(Contact, on_delete=models.CASCADE, related_name="campaign_participations")
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default="pending")
    attempts_count = models.PositiveIntegerField(default=0)
    last_attempt_at = models.DateTimeField(null=True, blank=True)
    custom_variables = models.JSONField(default=dict, blank=True)
    notes = models.TextField(blank=True, default="")

    # Sarvam Follow-up Orchestration
    followup_status = models.CharField(max_length=32, choices=FOLLOWUP_STATUS_CHOICES, default="pending")
    followup_reason = models.CharField(max_length=64, choices=FOLLOWUP_REASON_CHOICES, blank=True, null=True, default=None)
    followup_round = models.PositiveIntegerField(default=0)
    followup_eligible_at = models.DateTimeField(null=True, blank=True)
    previous_conversation = models.TextField(blank=True, default="", help_text="Stored transcript excerpt for context continuity")
    sarvam_cohort_id = models.CharField(max_length=128, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("campaign", "contact")
        indexes = [
            models.Index(fields=["campaign", "status"]),
        ]

    def __str__(self):
        return f"{self.contact.name} in {self.campaign.name} [{self.status}]"
