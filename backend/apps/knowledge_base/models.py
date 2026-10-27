from django.db import models
from apps.organizations.models import Organization
from apps.agents.models import VoiceAgent

class KnowledgeBaseFile(models.Model):
    STATUS_CHOICES = (
        ("uploaded", "Uploaded"),
        ("parsed", "Parsed & Ready"),
        ("attached", "Attached to Agent"),
        ("failed", "Processing Failed"),
    )

    CATEGORY_CHOICES = (
        ("site", "Website / URL"),
        ("document", "Document File"),
        ("text", "Pasted Text / Notes"),
    )

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="knowledge_files")
    agent = models.ForeignKey(VoiceAgent, on_delete=models.SET_NULL, null=True, blank=True, related_name="knowledge_files")
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=32, choices=CATEGORY_CHOICES, default="document")
    source_url = models.URLField(max_length=1024, blank=True, default="")
    file_type = models.CharField(max_length=32, default="TXT")
    file_size_bytes = models.PositiveIntegerField(default=0)
    file = models.FileField(upload_to="knowledge_base/%Y/%m/", null=True, blank=True)
    raw_text = models.TextField(blank=True, default="")
    content_summary = models.TextField(blank=True, default="")
    word_count = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default="uploaded")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} [{self.category}] ({self.status})"
