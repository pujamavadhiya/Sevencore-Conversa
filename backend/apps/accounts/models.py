from django.db import models
from django.contrib.auth.models import User
from apps.organizations.models import Organization

class OrganizationMember(models.Model):
    ROLE_CHOICES = (
        ("admin", "Administrator"),
        ("manager", "Campaign Manager"),
        ("agent", "Agent / Viewer"),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="memberships")
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="members")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="admin")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "organization")

    def __str__(self):
        return f"{self.user.username} ({self.role}) @ {self.organization.name}"
