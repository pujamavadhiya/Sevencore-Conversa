from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from sarvam_history import (
    init_db,
    list_campaign_history,
    campaign_calls,
    user_attempts_in_campaign,
    single_call_history,
    call_detail,
    call_transcript,
)
import asyncio

# Ensure DB schema and seed is initialized
init_db()


class HistoryCampaignsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        data = list_campaign_history()
        return Response(data)


class HistoryCampaignCallsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, campaign_id):
        disposition = request.query_params.get("disposition")
        reason = request.query_params.get("reason")
        user_identifier = request.query_params.get("user_identifier")
        include_debug = request.query_params.get("include_debug", "false").lower() in ("true", "1")
        limit = int(request.query_params.get("limit", 50))
        offset = int(request.query_params.get("offset", 0))

        data = campaign_calls(
            campaign_id=campaign_id,
            disposition=disposition,
            reason=reason,
            user_identifier=user_identifier,
            include_debug=include_debug,
            limit=limit,
            offset=offset,
        )
        return Response(data)


class HistoryCampaignUserAttemptsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, campaign_id, user_identifier):
        data = user_attempts_in_campaign(campaign_id=campaign_id, user_identifier=user_identifier)
        return Response(data)


class HistorySingleCallsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        disposition = request.query_params.get("disposition")
        include_debug = request.query_params.get("include_debug", "false").lower() in ("true", "1")
        limit = int(request.query_params.get("limit", 50))
        offset = int(request.query_params.get("offset", 0))

        data = single_call_history(
            disposition=disposition,
            include_debug=include_debug,
            limit=limit,
            offset=offset,
        )
        return Response(data)


class HistoryCallDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, attempt_id):
        try:
            data = call_detail(attempt_id=attempt_id)
            return Response(data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_404_NOT_FOUND)


class HistoryCallTranscriptView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, attempt_id):
        try:
            # Run async transcript generator
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            
            if loop.is_running():
                data = asyncio.run_coroutine_threadsafe(call_transcript(attempt_id=attempt_id), loop).result()
            else:
                data = loop.run_until_complete(call_transcript(attempt_id=attempt_id))
            return Response(data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_404_NOT_FOUND)

