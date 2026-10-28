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
        camp = serializer.save(organization=org)
        try:
            from sarvam_history import register_campaign
            register_campaign(
                campaign_id=str(camp.id),
                name=camp.name,
                agent_id=str(camp.agent_id),
                start_iso=camp.scheduled_start_time.isoformat() if camp.scheduled_start_time else None,
            )
        except Exception:
            pass

    def perform_update(self, serializer):
        camp = serializer.save()
        try:
            from sarvam_history import register_campaign
            register_campaign(
                campaign_id=str(camp.id),
                name=camp.name,
                agent_id=str(camp.agent_id),
                start_iso=camp.scheduled_start_time.isoformat() if camp.scheduled_start_time else None,
            )
        except Exception:
            pass

    @action(detail=True, methods=["post"])
    def add_contacts(self, request, pk=None):
        """
        Adds selected contacts or newly pasted contacts to this campaign.
        Supports:
          - contact_ids: list of existing Contact IDs
          - raw_contacts: list of {"name": "...", "phone_number": "...", "company": "..."}
          - add_all: boolean
        """
        campaign = self.get_object()
        contact_ids = list(request.data.get("contact_ids", []))
        raw_contacts = request.data.get("raw_contacts", [])
        add_all = request.data.get("add_all", False)

        from apps.contacts.models import Contact
        from apps.contacts.importer import validate_indian_mobile

        if raw_contacts and isinstance(raw_contacts, list):
            for rc in raw_contacts:
                p_raw = rc.get("phone_number") or rc.get("phone") or ""
                if not p_raw:
                    continue
                valid, normalized = validate_indian_mobile(str(p_raw))
                if not valid:
                    continue
                c_obj, _ = Contact.objects.update_or_create(
                    organization=campaign.organization,
                    phone_number=normalized,
                    defaults={
                        "name": rc.get("name") or "Contact",
                        "company": rc.get("company", ""),
                        "email": rc.get("email", ""),
                        "has_consent": True,
                    }
                )
                if c_obj.id not in contact_ids:
                    contact_ids.append(c_obj.id)

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

    @action(detail=True, methods=["post"])
    def upload_sheet(self, request, pk=None):
        """Uploads and imports a CSV/Excel sheet directly into this campaign."""
        campaign = self.get_object()
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response({"error": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST)

        from apps.contacts.importer import execute_import, parse_contacts_file, validate_indian_mobile
        try:
            audit = execute_import(campaign.organization, uploaded_file, uploaded_file.name)
            uploaded_file.seek(0)
            rows = parse_contacts_file(uploaded_file, uploaded_file.name)
            phones = []
            for r in rows:
                p_raw = r.get("phone") or r.get("phone_number") or r.get("mobile") or r.get("contact_no") or ""
                v, norm = validate_indian_mobile(p_raw)
                if v:
                    phones.append(norm)

            contacts = Contact.objects.filter(organization=campaign.organization, phone_number__in=phones, is_opted_out=False)
            added = 0
            for c in contacts:
                _, created = CampaignContact.objects.get_or_create(
                    campaign=campaign,
                    contact=c,
                    defaults={"status": "pending"}
                )
                if created:
                    added += 1

            total_audience = campaign.campaign_contacts.count()
            campaign.total_contacts = total_audience
            campaign.estimated_cost_inr = round(total_audience * 1.5 * 3.50, 2)
            campaign.save()

            return Response({
                "success": True,
                "imported_count": audit.imported_count,
                "rejected_count": audit.rejected_count,
                "added_to_campaign": added,
                "total_contacts": total_audience,
                "estimated_cost_inr": campaign.estimated_cost_inr,
            })
        except Exception as e:
            return Response({"error": f"Failed to upload and import sheet: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

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
        If scheduled_start_time is set in the future and immediate is not True,
        transitions campaign to 'scheduled' status without initiating live calls.
        """
        from django.utils import timezone
        campaign = self.get_object()
        confirm = request.data.get("confirm", False)
        bypass_hours = request.data.get("bypass_hours", False)
        immediate = request.data.get("immediate", False)

        if not confirm:
            return Response(
                {"success": False, "error": "Mandatory Confirmation Missing: You must explicitly confirm campaign execution."},
                status=status.HTTP_400_BAD_REQUEST
            )

        campaign.is_confirmed = True

        # Check if campaign has a scheduled start time in the future and not forced immediate
        now = timezone.now()
        if not immediate and campaign.scheduled_start_time and campaign.scheduled_start_time > now:
            campaign.status = "scheduled"
            campaign.save()
            return Response({
                "success": True,
                "status": "scheduled",
                "scheduled_start_time": campaign.scheduled_start_time.isoformat(),
                "message": f"Campaign '{campaign.name}' successfully scheduled to start on {campaign.scheduled_start_time.strftime('%b %d, %Y at %I:%M %p')}.",
            })

        campaign.save()

        result = CampaignExecutionEngine.validate_and_start(campaign, bypass_hours_check=bypass_hours)
        if not result.get("success"):
            return Response(result, status=status.HTTP_400_BAD_REQUEST)

        return Response(result)

    @action(detail=True, methods=["post"])
    def start_now(self, request, pk=None):
        """
        Force-starts a scheduled campaign immediately ahead of its scheduled time.
        """
        campaign = self.get_object()
        bypass_hours = request.data.get("bypass_hours", False)
        campaign.is_confirmed = True
        campaign.status = "running"
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

    @action(detail=True, methods=["post"])
    def dispatch_followups(self, request, pk=None):
        """
        Triggers a follow-up batch cohort dispatch for all eligible pending follow-up contacts in this campaign.
        Injects followup_reason, followup_round, and previous_conversation variables.
        """
        campaign = self.get_object()
        label = request.data.get("label")
        result = CampaignExecutionEngine.dispatch_followup_cohort(campaign, batch_label=label)
        return Response(result)

    @action(detail=True, methods=["get"])
    def followups(self, request, pk=None):
        """
        Returns all follow-up contacts grouped or filtered by status.
        """
        campaign = self.get_object()
        status_param = request.query_params.get("status")
        qs = campaign.campaign_contacts.select_related("contact").order_by("-updated_at")
        if status_param:
            qs = qs.filter(followup_status=status_param)
        else:
            qs = qs.exclude(followup_status="pending")
        serializer = CampaignContactSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["post"])
    def dispatch_all_due(self, request):
        """
        Global scheduler endpoint:
        1. Checks and triggers any campaigns in 'scheduled' status whose scheduled_start_time <= now.
        2. Dispatches eligible follow-ups across all active campaigns.
        Can be called by Celery beat, cron, or manual trigger.
        """
        from django.utils import timezone
        now = timezone.now()

        # 1. Trigger due scheduled campaigns
        due_scheduled = Campaign.objects.filter(status="scheduled", scheduled_start_time__lte=now)
        started_campaigns = []
        for camp in due_scheduled:
            res = CampaignExecutionEngine.validate_and_start(camp)
            started_campaigns.append({"campaign_id": camp.id, "name": camp.name, "result": res})

        # 2. Trigger due follow-ups
        active_campaigns = Campaign.objects.filter(status__in=["running", "completed"])
        total_queued = 0
        campaign_results = []
        for camp in active_campaigns:
            res = CampaignExecutionEngine.dispatch_followup_cohort(camp)
            if res.get("queued", 0) > 0:
                total_queued += res["queued"]
                campaign_results.append({"campaign_id": camp.id, "queued": res["queued"]})

        return Response({
            "success": True,
            "scheduled_campaigns_started": started_campaigns,
            "total_queued": total_queued,
            "campaigns": campaign_results,
        })
