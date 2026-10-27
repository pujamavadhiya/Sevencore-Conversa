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

    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name="campaign_contacts")
    contact = models.ForeignKey(Contact, on_delete=models.CASCADE, related_name="campaign_participations")
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default="pending")
    attempts_count = models.PositiveIntegerField(default=0)
    last_attempt_at = models.DateTimeField(null=True, blank=True)
    custom_variables = models.JSONField(default=dict, blank=True)
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("campaign", "contact")
        indexes = [
            models.Index(fields=["campaign", "status"]),
        ]

    def __str__(self):
        return f"{self.contact.name} in {self.campaign.name} [{self.status}]"
