from rest_framework import serializers
from .models import Organization

class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = [
            "id",
            "name",
            "slug",
            "timezone",
            "compliance_mode",
            "max_daily_budget_inr",
            "created_at",
            "updated_at",
        ]
