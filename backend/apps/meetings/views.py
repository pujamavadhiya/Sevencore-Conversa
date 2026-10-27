from rest_framework import viewsets, permissions
from .models import Meeting
from .serializers import MeetingSerializer
from apps.organizations.models import Organization

class MeetingViewSet(viewsets.ModelViewSet):
    queryset = Meeting.objects.all().select_related("contact", "call_attempt").order_by("-scheduled_time")
    serializer_class = MeetingSerializer
    permission_classes = [permissions.AllowAny]

    def perform_create(self, serializer):
        org = Organization.objects.first()
        serializer.save(organization=org)
