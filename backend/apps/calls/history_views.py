from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from django.http import StreamingHttpResponse
from sarvam_history import (
    init_db,
    list_campaign_history,
    campaign_calls,
    user_attempts_in_campaign,
    single_call_history,
    call_detail,
    call_transcript,
)
from sarvam_ondemand import (
    init_ondemand_db,
    live_attempts,
    live_interactions,
    call_full,
    interaction_transcript,
    interaction_recording,
    start_backfill,
    backfill_status,
    qa_sample,
    _agent_for_interaction,
    _base,
    enc_id,
    HEADERS,
    _set_recording,
)
import asyncio
import concurrent.futures

# Ensure DB schemas are initialized
init_db()
init_ondemand_db()


def run_coro(coro):
    """Safely run async coroutine from synchronous Django view."""
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        return executor.submit(asyncio.run, coro).result()


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
            data = run_coro(call_transcript(attempt_id=attempt_id))
            return Response(data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_404_NOT_FOUND)


# --------------------- ON-DEMAND LIVE & FULL HISTORY ---------------------

class HistoryLiveAttemptsView(APIView):
    """Live attempts queried on demand from Sarvam Analytics with PII scrubbing."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from datetime import datetime, timezone, timedelta
        now = datetime.now(timezone.utc)
        start = request.query_params.get("start") or (now - timedelta(days=7)).isoformat()
        end = request.query_params.get("end") or now.isoformat()
        agent_id = request.query_params.get("agent_id") or "agent_sales_v1"
        filters = request.query_params.get("filters")
        status_filter = request.query_params.get("status")
        campaign_id = request.query_params.get("campaign_id")
        min_duration = float(request.query_params["min_duration"]) if request.query_params.get("min_duration") else None
        max_duration = float(request.query_params["max_duration"]) if request.query_params.get("max_duration") else None
        limit = min(int(request.query_params.get("limit", 20)), 1000)
        offset = int(request.query_params.get("offset", 0))

        try:
            data = run_coro(
                live_attempts(
                    start=start,
                    end=end,
                    agent_id=agent_id,
                    filters=filters,
                    status=status_filter,
                    campaign_id=campaign_id,
                    min_duration=min_duration,
                    max_duration=max_duration,
                    limit=limit,
                    offset=offset,
                )
            )
            return Response(data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class HistoryLiveInteractionsView(APIView):
    """Live interactions queried on demand from Sarvam Analytics with PII scrubbing."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from datetime import datetime, timezone, timedelta
        now = datetime.now(timezone.utc)
        start = request.query_params.get("start") or (now - timedelta(days=7)).isoformat()
        end = request.query_params.get("end") or now.isoformat()
        agent_id = request.query_params.get("agent_id") or "agent_sales_v1"
        filters = request.query_params.get("filters")
        campaign_id = request.query_params.get("campaign_id")
        min_duration = float(request.query_params["min_duration"]) if request.query_params.get("min_duration") else None
        max_duration = float(request.query_params["max_duration"]) if request.query_params.get("max_duration") else None
        include_transcript = request.query_params.get("include_transcript", "false").lower() in ("true", "1")
        limit = min(int(request.query_params.get("limit", 20)), 1000)
        offset = int(request.query_params.get("offset", 0))

        try:
            data = run_coro(
                live_interactions(
                    start=start,
                    end=end,
                    agent_id=agent_id,
                    filters=filters,
                    campaign_id=campaign_id,
                    min_duration=min_duration,
                    max_duration=max_duration,
                    include_transcript=include_transcript,
                    limit=limit,
                    offset=offset,
                )
            )
            return Response(data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class HistoryCallFullView(APIView):
    """One call, completely joined: attempt + interaction + transcript + translation + recording link."""
    permission_classes = [permissions.AllowAny]

    def get(self, request, attempt_id):
        refresh = request.query_params.get("refresh", "false").lower() in ("true", "1")
        try:
            data = run_coro(call_full(attempt_id=attempt_id, refresh=refresh))
            return Response(data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_404_NOT_FOUND)


class HistoryInteractionTranscriptView(APIView):
    """Fetch transcript and English translation for a specific interaction_id."""
    permission_classes = [permissions.AllowAny]

    def get(self, request, interaction_id):
        agent_id = request.query_params.get("agent_id")
        try:
            data = run_coro(interaction_transcript(interaction_id=interaction_id, agent_id=agent_id))
            return Response(data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_404_NOT_FOUND)


class HistoryInteractionRecordingView(APIView):
    """Streams the audio recording WAV directly from Sarvam with Range header seeking support."""
    permission_classes = [permissions.AllowAny]

    def get(self, request, interaction_id):
        import httpx

        interaction_id = interaction_id.strip("/")
        agent = _agent_for_interaction(interaction_id, request.query_params.get("agent_id"))
        try:
            url = f"{_base(agent)}/recordings/{enc_id(interaction_id)}"
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        headers = dict(HEADERS)
        range_header = request.headers.get("Range") or request.META.get("HTTP_RANGE")
        if range_header:
            headers["Range"] = range_header

        client = httpx.Client(timeout=30)
        try:
            upstream = client.send(client.build_request("GET", url, headers=headers), stream=True)
            if upstream.status_code >= 400:
                code = upstream.status_code
                upstream.close()
                client.close()
                if code == 404:
                    _set_recording(interaction_id, "none")
                    return Response({"error": "No recording exists for this interaction"}, status=status.HTTP_404_NOT_FOUND)
                return Response({"error": "Recording unavailable"}, status=code if code < 500 else 502)

            response = StreamingHttpResponse(
                upstream.iter_bytes(),
                status=upstream.status_code,
                content_type=upstream.headers.get("content-type", "audio/wav"),
            )
            for k in ("content-length", "content-range", "accept-ranges", "content-disposition"):
                val = upstream.headers.get(k)
                if val:
                    response[k] = val
            return response
        except Exception as exc:
            client.close()
            return Response({"error": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)


class HistoryBackfillView(APIView):
    """Trigger or query bulk backfill jobs."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        try:
            data = run_coro(start_backfill(request.data))
            return Response(data, status=status.HTTP_202_ACCEPTED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class HistoryBackfillStatusView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, job_id):
        try:
            data = backfill_status(job_id=job_id)
            return Response(data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_404_NOT_FOUND)


class HistoryQASampleView(APIView):
    """Random sample of short calls, failures, and follow-ups for QA listening."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        campaign_id = request.query_params.get("campaign_id")
        short_under = float(request.query_params.get("short_under_seconds", 25))
        n = min(int(request.query_params.get("n", 20)), 200)
        include = request.query_params.get("include", "short,failed,followup")

        try:
            data = qa_sample(campaign_id=campaign_id, short_under_seconds=short_under, n=n, include=include)
            return Response(data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


