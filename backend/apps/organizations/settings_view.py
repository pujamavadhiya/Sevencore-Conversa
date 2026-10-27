from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from django.conf import settings
from .models import Organization
from config.branding import (
    PRODUCT_NAME,
    TAGLINE,
    BRAND_POSITIONING,
    SUPPORT_EMAIL,
    DEFAULT_TIMEZONE,
    CURRENCY_CODE,
    CURRENCY_SYMBOL,
    TELEPHONY_PROVIDER,
)
from integrations.sarvam.factory import get_provider_status

class SystemSettingsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        org = Organization.objects.first()
        provider = get_provider_status()

        return Response({
            "branding": {
                "product_name": PRODUCT_NAME,
                "tagline": TAGLINE,
                "positioning": BRAND_POSITIONING,
                "support_email": SUPPORT_EMAIL,
                "telephony_provider": TELEPHONY_PROVIDER,
            },
            "organization": {
                "id": org.id if org else None,
                "name": org.name if org else PRODUCT_NAME,
                "timezone": org.timezone if org else DEFAULT_TIMEZONE,
                "currency_code": CURRENCY_CODE,
                "currency_symbol": CURRENCY_SYMBOL,
                "compliance_mode": org.compliance_mode if org else True,
                "max_daily_budget_inr": org.max_daily_budget_inr if org else 2000.00,
            },
            "compliance_rules": {
                "calling_window_start": getattr(settings, "CALLING_WINDOW_START_HOUR", 9),
                "calling_window_end": getattr(settings, "CALLING_WINDOW_END_HOUR", 20),
                "calling_window_label": "09:00 AM to 08:00 PM IST (TRAI Compliant)",
                "max_calls_per_second": getattr(settings, "MAX_CALLS_PER_SECOND", 2),
                "default_max_retries": getattr(settings, "DEFAULT_MAX_RETRIES", 2),
                "region_restricted": "India Only (+91)",
            },
            "sarvam_provider": provider,
        })

    def patch(self, request):
        org = Organization.objects.first()
        if not org:
            org = Organization.objects.create(name=PRODUCT_NAME)

        data = request.data
        if "name" in data:
            org.name = data["name"].strip()
        if "compliance_mode" in data:
            org.compliance_mode = bool(data["compliance_mode"])
        if "max_daily_budget_inr" in data:
            try:
                org.max_daily_budget_inr = float(data["max_daily_budget_inr"])
            except ValueError:
                pass
        org.save()

        return Response({"success": True, "message": "Settings updated successfully"})
