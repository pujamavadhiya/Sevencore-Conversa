from rest_framework import serializers
from .models import Contact, SuppressionEntry, ContactImport

class ContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = [
            "id",
            "organization",
            "name",
            "phone_number",
            "company",
            "email",
            "custom_fields",
            "has_consent",
            "is_opted_out",
            "consent_source",
            "notes",
            "created_at",
            "updated_at",
        ]

class SuppressionEntrySerializer(serializers.ModelSerializer):
    reason_display = serializers.CharField(source="get_reason_display", read_only=True)

    class Meta:
        model = SuppressionEntry
        fields = [
            "id",
            "organization",
            "phone_number",
            "reason",
            "reason_display",
            "notes",
            "created_at",
        ]

class ContactImportSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactImport
        fields = [
            "id",
            "organization",
            "filename",
            "total_rows",
            "imported_count",
            "rejected_count",
            "rejection_details",
            "created_at",
        ]
