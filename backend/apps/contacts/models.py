import re
from django.db import models
from apps.organizations.models import Organization

def normalize_indian_phone(phone_str: str) -> str:
    """
    Normalizes Indian phone numbers into clean E.164 format (+91XXXXXXXXXX).
    Rejects invalid formats or non-Indian phone lengths.
    """
    if not phone_str:
        return ""
    # Strip spaces, dashes, parentheses
    clean = re.sub(r"[^\d+]", "", str(phone_str).strip())
    
    # If starts with +91
    if clean.startswith("+91"):
        digits = clean[3:]
    elif clean.startswith("91") and len(clean) == 12:
        digits = clean[2:]
    elif clean.startswith("0") and len(clean) == 11:
        digits = clean[1:]
    else:
        digits = clean
    
    # Standard Indian mobile numbers are 10 digits starting with 6, 7, 8, or 9
    # Some Sarvam landlines start with 080, 079 etc. (10 digits total)
    if len(digits) == 10 and digits.isdigit():
        return f"+91{digits}"
    return clean  # Return raw if irregular, to be flagged by validator

class Contact(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="contacts")
    name = models.CharField(max_length=255)
    phone_number = models.CharField(max_length=32, db_index=True)
    company = models.CharField(max_length=255, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    custom_fields = models.JSONField(default=dict, blank=True)
    
    # Compliance & Consent
    has_consent = models.BooleanField(default=True, help_text="Explicit user consent to call")
    is_opted_out = models.BooleanField(default=False, help_text="Recipient has opted out / DND requested")
    consent_source = models.CharField(max_length=128, default="web_form", blank=True)
    notes = models.TextField(blank=True, default="")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("organization", "phone_number")
        indexes = [
            models.Index(fields=["organization", "phone_number"]),
        ]

    def save(self, *args, **kwargs):
        self.phone_number = normalize_indian_phone(self.phone_number)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.phone_number})"


class SuppressionEntry(models.Model):
    """
    Do Not Disturb (DND) / Opt-out suppression list.
    Any number in this list is unconditionally suppressed from all campaign dials.
    """
    REASON_CHOICES = (
        ("TRAI_NDNC", "TRAI National Do Not Call Registry"),
        ("USER_OPT_OUT", "Recipient Requested Opt-out on Call"),
        ("MANUAL_SUPPRESSION", "Manually Suppressed by Admin"),
        ("INVALID_NUMBER", "Permanently Invalid Number"),
    )

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="suppressions")
    phone_number = models.CharField(max_length=32, db_index=True)
    reason = models.CharField(max_length=64, choices=REASON_CHOICES, default="USER_OPT_OUT")
    notes = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("organization", "phone_number")

    def save(self, *args, **kwargs):
        self.phone_number = normalize_indian_phone(self.phone_number)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.phone_number} [{self.reason}]"


class ContactImport(models.Model):
    """
    Audit record for bulk spreadsheet imports (.csv / .xlsx).
    """
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="imports")
    filename = models.CharField(max_length=255)
    total_rows = models.PositiveIntegerField(default=0)
    imported_count = models.PositiveIntegerField(default=0)
    rejected_count = models.PositiveIntegerField(default=0)
    rejection_details = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.filename}: {self.imported_count} imported, {self.rejected_count} rejected"
