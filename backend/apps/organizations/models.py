from django.db import models
from django.utils.text import slugify

class Organization(models.Model):
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    timezone = models.CharField(max_length=64, default="Asia/Kolkata")
    compliance_mode = models.BooleanField(
        default=True,
        help_text="Enforces TRAI 09:00 - 20:00 IST calling window and NDNC suppression"
    )
    max_daily_budget_inr = models.DecimalField(
        max_digits=10, decimal_places=2, default=2000.00,
        help_text="Daily AI & telephony spend guardrail in INR"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.name) or "org"
            slug = base_slug
            counter = 1
            while Organization.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name
