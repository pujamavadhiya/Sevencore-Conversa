from decimal import Decimal
from django.db.models import Count, Sum, Avg
from django.utils import timezone
import datetime
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from apps.contacts.models import Contact
from apps.campaigns.models import Campaign
from apps.calls.models import CallAttempt
from apps.agents.models import VoiceAgent
from apps.meetings.models import Meeting
from integrations.sarvam.factory import get_provider_status

class DashboardSummaryView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        total_contacts = Contact.objects.count()
        total_campaigns = Campaign.objects.count()
        total_agents = VoiceAgent.objects.count()
        
        call_stats = CallAttempt.objects.aggregate(
            total_attempts=Count("id"),
            total_duration=Sum("duration_seconds"),
            avg_duration=Avg("duration_seconds"),
            total_cost=Sum("cost_inr"),
        )
        
        total_attempts = call_stats["total_attempts"] or 0
        total_seconds = call_stats["total_duration"] or 0.0
        total_minutes = round(total_seconds / 60.0, 1)
        avg_seconds = round(call_stats["avg_duration"] or 0.0, 1)
        total_cost = round(call_stats["total_cost"] or Decimal("0.00"), 2)

        calls_answered = CallAttempt.objects.filter(status="connected").count()
        calls_failed = CallAttempt.objects.filter(status__in=["failed", "busy", "no_answer"]).count()
        calls_pending = CallAttempt.objects.filter(status="initiated").count()
        
        pickup_rate = round((calls_answered / total_attempts * 100), 1) if total_attempts > 0 else 0.0

        # Recent campaigns
        recent_campaigns = list(
            Campaign.objects.order_by("-created_at")[:5].values(
                "id", "name", "status", "total_contacts", "calls_attempted", "calls_answered", "actual_cost_inr", "created_at"
            )
        )

        # Recent calls
        recent_calls = list(
            CallAttempt.objects.select_related("contact", "agent")
            .order_by("-created_at")[:8]
            .values(
                "id", "user_phone_number", "status", "duration_seconds", "cost_inr", "is_mock", "created_at",
                "contact__name", "agent__name"
            )
        )

        # Mask phone numbers in recent calls
        for c in recent_calls:
            phone = c.get("user_phone_number", "")
            if len(phone) >= 10:
                c["masked_phone"] = phone[:6] + "XXXX" + phone[-3:]
            else:
                c["masked_phone"] = phone

        # Upcoming scheduled meetings
        upcoming_meetings = list(
            Meeting.objects.filter(status__in=["requested", "confirmed"])
            .order_by("scheduled_time")[:5]
            .values("id", "title", "contact__name", "scheduled_time", "status")
        )

        provider_status = get_provider_status()

        return Response({
            "metrics": {
                "total_contacts": total_contacts,
                "total_campaigns": total_campaigns,
                "total_agents": total_agents,
                "calls_attempted": total_attempts,
                "calls_answered": calls_answered,
                "calls_completed": calls_answered,
                "calls_failed": calls_failed,
                "calls_pending": calls_pending,
                "pickup_rate_pct": pickup_rate,
                "total_minutes": total_minutes,
                "avg_duration_seconds": avg_seconds,
                "total_cost_inr": total_cost,
                "cost_unit": "INR (₹)",
            },
            "recent_campaigns": recent_campaigns,
            "recent_calls": recent_calls,
            "upcoming_meetings": upcoming_meetings,
            "provider_status": provider_status,
            "has_data": total_attempts > 0 or total_contacts > 0,
        })


class AnalyticsDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        # 7-day trend
        today = timezone.now().date()
        daily_trends = []
        for i in range(6, -1, -1):
            d = today - datetime.timedelta(days=i)
            day_start = timezone.make_aware(datetime.datetime.combine(d, datetime.time.min))
            day_end = timezone.make_aware(datetime.datetime.combine(d, datetime.time.max))
            
            attempts = CallAttempt.objects.filter(created_at__range=(day_start, day_end)).count()
            answered = CallAttempt.objects.filter(created_at__range=(day_start, day_end), status="connected").count()
            failed = CallAttempt.objects.filter(created_at__range=(day_start, day_end), status__in=["failed", "busy", "no_answer"]).count()
            cost = CallAttempt.objects.filter(created_at__range=(day_start, day_end)).aggregate(s=Sum("cost_inr"))["s"] or Decimal("0.00")
            
            daily_trends.append({
                "date": d.strftime("%d %b"),
                "attempts": attempts,
                "answered": answered,
                "failed": failed,
                "cost_inr": float(round(cost, 2)),
            })

        # Disposition breakdowns
        disposition_counts = list(
            CallAttempt.objects.values("status").annotate(count=Count("id")).order_by("-count")
        )

        # Duration distribution (<30s, 30s-60s, 60s-120s, >120s)
        duration_distribution = {
            "under_30s": CallAttempt.objects.filter(status="connected", duration_seconds__lt=30).count(),
            "30_to_60s": CallAttempt.objects.filter(status="connected", duration_seconds__gte=30, duration_seconds__lt=60).count(),
            "60_to_120s": CallAttempt.objects.filter(status="connected", duration_seconds__gte=60, duration_seconds__lt=120).count(),
            "over_120s": CallAttempt.objects.filter(status="connected", duration_seconds__gte=120).count(),
        }

        return Response({
            "daily_trends": daily_trends,
            "disposition_counts": disposition_counts,
            "duration_distribution": duration_distribution,
        })
