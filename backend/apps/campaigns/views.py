from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Campaign, CampaignContact
from .serializers import CampaignSerializer, CampaignContactSerializer
from .engine import CampaignExecutionEngine
from apps.contacts.models import Contact, SuppressionEntry
from apps.organizations.models import Organization
from integrations.sarvam.compliance import is_within_permitted_calling_hours

class CampaignViewSet(viewsets.ModelViewSet):
    queryset = Campaign.objects.all().order_by("-created_at")
    serializer_class = CampaignSerializer
    permission_classes = [permissions.AllowAny]

    def perform_create(self, serializer):
        org = Organization.objects.first()
        serializer.save(organization=org)

    @action(detail=True, methods=["post"])
    def add_contacts(self, request, pk=None):
        """Adds selected contacts or all eligible contacts to this campaign."""
        campaign = self.get_object()
        contact_ids = request.data.get("contact_ids", [])
        add_all = request.data.get("add_all", False)

        if add_all:
            contacts = Contact.objects.filter(organization=campaign.organization, is_opted_out=False)
        else:
            contacts = Contact.objects.filter(id__in=contact_ids, is_opted_out=False)

        added = 0
        for c in contacts:
            _, created = CampaignContact.objects.get_or_create(
                campaign=campaign,
                contact=c,
                defaults={"status": "pending"}
            )
            if created:
                added += 1

        # Calculate estimated budget at ₹3.50/min (assuming average 1.5 min per call)
        total_audience = campaign.campaign_contacts.count()
        campaign.total_contacts = total_audience
        campaign.estimated_cost_inr = round(total_audience * 1.5 * 3.50, 2)
        campaign.save()

        return Response({
            "success": True,
            "added_count": added,
            "total_contacts": total_audience,
            "estimated_cost_inr": campaign.estimated_cost_inr,
        })

    @action(detail=True, methods=["get"])
    def preflight_check(self, request, pk=None):
        """Runs pre-flight compliance, audience, and budget check before campaign launch."""
        campaign = self.get_object()
        allowed_hours, hours_msg = is_within_permitted_calling_hours(
            campaign.calling_window_start.hour,
            campaign.calling_window_end.hour
        )

        total_contacts = campaign.campaign_contacts.count()
        suppressed_numbers = set(
            SuppressionEntry.objects.filter(organization=campaign.organization).values_list("phone_number", flat=True)
        )
        
        # Count contacts currently in DND
        dnd_matches = campaign.campaign_contacts.filter(contact__phone_number__in=suppressed_numbers).count()
        valid_audience = max(0, total_contacts - dnd_matches)

        can_launch = (valid_audience > 0) and allowed_hours

        return Response({
            "can_launch": can_launch,
            "calling_hours_check": {"allowed": allowed_hours, "message": hours_msg},
            "total_audience": total_contacts,
            "dnd_suppressed_count": dnd_matches,
            "eligible_audience": valid_audience,
            "estimated_cost_inr": campaign.estimated_cost_inr,
            "daily_budget_limit_inr": campaign.organization.max_daily_budget_inr,
            "agent_configured": bool(campaign.agent_id),
            "is_confirmed": campaign.is_confirmed,
        })

    @action(detail=True, methods=["post"])
    def launch(self, request, pk=None):
        """
        Launches the campaign. Requires explicit confirm=True.
        """
        campaign = self.get_object()
        confirm = request.data.get("confirm", False)
        bypass_hours = request.data.get("bypass_hours", False)

        if not confirm:
            return Response(
                {"success": False, "error": "Mandatory Confirmation Missing: You must explicitly confirm campaign execution."},
                status=status.HTTP_400_BAD_REQUEST
            )

        campaign.is_confirmed = True
        campaign.save()

        result = CampaignExecutionEngine.validate_and_start(campaign, bypass_hours_check=bypass_hours)
        if not result.get("success"):
            return Response(result, status=status.HTTP_400_BAD_REQUEST)

        return Response(result)

    @action(detail=True, methods=["post"])
    def pause(self, request, pk=None):
        campaign = self.get_object()
        campaign.status = "paused"
        campaign.save()
        return Response({"success": True, "status": "paused"})

    @action(detail=True, methods=["post"])
    def resume(self, request, pk=None):
        campaign = self.get_object()
        campaign.status = "running"
        campaign.save()
        result = CampaignExecutionEngine.dispatch_pending_batch(campaign)
        return Response(result)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        campaign = self.get_object()
        campaign.status = "cancelled"
        campaign.campaign_contacts.filter(status="pending").update(status="failed", notes="Campaign cancelled by user")
        campaign.save()
        return Response({"success": True, "status": "cancelled"})

    @action(detail=True, methods=["get"])
    def contacts(self, request, pk=None):
        campaign = self.get_object()
        contacts = campaign.campaign_contacts.select_related("contact").order_by("-id")
        serializer = CampaignContactSerializer(contacts, many=True)
        return Response(serializer.data)
