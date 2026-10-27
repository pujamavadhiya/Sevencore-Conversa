from django.db import models
from apps.organizations.models import Organization
from apps.contacts.models import Contact
from apps.calls.models import CallAttempt

class Meeting(models.Model):
    STATUS_CHOICES = (
        ("requested", "Follow-up Requested by Caller"),
        ("confirmed", "Confirmed with Representative"),
        ("completed", "Meeting Completed"),
        ("cancelled", "Cancelled / No Show"),
    )

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="meetings")
    contact = models.ForeignKey(Contact, on_delete=models.CASCADE, related_name="meetings")
    call_attempt = models.ForeignKey(CallAttempt, on_delete=models.SET_NULL, null=True, blank=True, related_name="meetings")
    
    title = models.CharField(max_length=255, default="Follow-up Call")
    scheduled_time = models.DateTimeField(help_text="Scheduled date and time in IST")
    timezone = models.CharField(max_length=64, default="Asia/Kolkata")
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default="requested")
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.title} with {self.contact.name} on {self.scheduled_time} ({self.status})"
