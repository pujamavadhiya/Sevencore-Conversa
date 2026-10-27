from rest_framework import serializers
from .models import Meeting
from apps.contacts.serializers import ContactSerializer

class MeetingSerializer(serializers.ModelSerializer):
    contact_details = ContactSerializer(source="contact", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Meeting
        fields = [
            "id",
            "organization",
            "contact",
            "contact_details",
            "call_attempt",
            "title",
            "scheduled_time",
            "timezone",
            "status",
            "status_display",
            "notes",
            "created_at",
            "updated_at",
        ]
