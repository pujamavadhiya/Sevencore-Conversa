from django.db import models
from apps.organizations.models import Organization

class VoiceAgent(models.Model):
    LANGUAGE_CHOICES = (
        ("Hindi", "Hindi (हिन्दी)"),
        ("English", "Indian English"),
        ("Marathi", "Marathi (मराठी)"),
        ("Gujarati", "Gujarati (ગુજરાતી)"),
        ("Tamil", "Tamil (தமிழ்)"),
        ("Telugu", "Telugu (తెలుగు)"),
        ("Kannada", "Kannada (ಕನ್ನಡ)"),
        ("Bengali", "Bengali (বাংলা)"),
        ("Punjabi", "Punjabi (ਪੰਜਾਬੀ)"),
        ("Malayalam", "Malayalam (മലയാളം)"),
        ("Odia", "Odia (ଓଡ଼ିଆ)"),
        ("Assamese", "Assamese (অসমীয়া)"),
        ("Sanskrit", "Sanskrit (संस्कृतम्)"),
    )

    PURPOSE_CHOICES = (
        ("sales_qualification", "Sales Qualification"),
        ("appointment_confirmation", "Appointment Confirmation"),
        ("customer_support", "Customer Support"),
        ("emi_collection", "EMI & Payment Follow-up"),
        ("lead_followup", "Lead Re-engagement"),
    )

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="agents")
    name = models.CharField(max_length=128)
    purpose = models.CharField(max_length=64, choices=PURPOSE_CHOICES, default="sales_qualification")
    sarvam_app_id = models.CharField(
        max_length=128,
        help_text="Sarvam Voice Agent App ID (from Sarvam Canvas / Dashboard)"
    )
    sarvam_app_version = models.PositiveIntegerField(
        default=1,
        help_text="Committed Sarvam App Version (1, 2, ...)"
    )
    primary_language = models.CharField(max_length=32, choices=LANGUAGE_CHOICES, default="Hindi")
    voice_model = models.CharField(max_length=32, default="Bulbul v4")
    speaker = models.CharField(max_length=64, default="meera")
    greeting_message = models.TextField(
        help_text="Opening spoken sentence when recipient picks up the call"
    )
    system_instructions = models.TextField(
        help_text="Prompt instructions, persona, tone, guardrails and escalation rules"
    )
    turn_timeout_seconds = models.PositiveIntegerField(
        default=7,
        help_text="Silence duration in seconds before agent takes the turn or nudges the caller"
    )
    max_conversation_duration_seconds = models.PositiveIntegerField(
        default=600,
        help_text="Maximum allowed call duration in seconds (e.g. 600 = 10 minutes)"
    )
    config = models.JSONField(
        default=dict,
        blank=True,
        help_text="Extended agent configuration including speaking voices, listening, environment, language personalisation, and in-call actions"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.get_primary_language_display()})"
