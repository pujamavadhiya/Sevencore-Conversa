from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.accounts.views import LoginView, LogoutView, CurrentUserView
from apps.organizations.views import OrganizationViewSet
from apps.organizations.settings_view import SystemSettingsView
from apps.agents.views import VoiceAgentViewSet
from apps.knowledge_base.views import KnowledgeBaseViewSet
from apps.contacts.views import ContactViewSet, SuppressionEntryViewSet, ContactImportViewSet
from apps.campaigns.views import CampaignViewSet
from apps.calls.views import CallAttemptViewSet, TranscriptViewSet
from apps.calls.webhook import SarvamWebhookView
from apps.calls.history_views import (
    HistoryCampaignsView,
    HistoryCampaignCallsView,
    HistoryCampaignUserAttemptsView,
    HistorySingleCallsView,
    HistoryCallDetailView,
    HistoryCallTranscriptView,
    HistoryLiveAttemptsView,
    HistoryLiveInteractionsView,
    HistoryCallFullView,
    HistoryInteractionTranscriptView,
    HistoryInteractionRecordingView,
    HistoryBackfillView,
    HistoryBackfillStatusView,
    HistoryQASampleView,
)
from apps.meetings.views import MeetingViewSet
from apps.analytics.views import DashboardSummaryView, AnalyticsDetailView

router = DefaultRouter()
router.register(r"organizations", OrganizationViewSet, basename="organization")
router.register(r"agents", VoiceAgentViewSet, basename="agent")
router.register(r"knowledge-base", KnowledgeBaseViewSet, basename="knowledge-base")
router.register(r"contacts", ContactViewSet, basename="contact")
router.register(r"suppressions", SuppressionEntryViewSet, basename="suppression")
router.register(r"imports", ContactImportViewSet, basename="import")
router.register(r"campaigns", CampaignViewSet, basename="campaign")
router.register(r"calls", CallAttemptViewSet, basename="call")
router.register(r"transcripts", TranscriptViewSet, basename="transcript")
router.register(r"meetings", MeetingViewSet, basename="meeting")

urlpatterns = [
    path("admin/", admin.site.urls),
    
    # REST API v1
    path("api/v1/auth/login/", LoginView.as_view(), name="auth-login"),
    path("api/v1/auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("api/v1/auth/me/", CurrentUserView.as_view(), name="auth-me"),
    
    path("api/v1/dashboard/", DashboardSummaryView.as_view(), name="dashboard-summary"),
    path("api/v1/analytics/", AnalyticsDetailView.as_view(), name="analytics-detail"),
    path("api/v1/settings/", SystemSettingsView.as_view(), name="system-settings"),
    
    # Sarvam Webhook receiver
    path("api/v1/webhooks/sarvam/", SarvamWebhookView.as_view(), name="sarvam-webhook"),

    # Separated History & Transcript Pipeline API
    path("api/v1/history/campaigns/", HistoryCampaignsView.as_view(), name="history-campaigns"),
    path("api/v1/history/campaigns/<str:campaign_id>/calls/", HistoryCampaignCallsView.as_view(), name="history-campaign-calls"),
    path("api/v1/history/campaigns/<str:campaign_id>/users/<str:user_identifier>/", HistoryCampaignUserAttemptsView.as_view(), name="history-campaign-user-attempts"),
    path("api/v1/history/single-calls/", HistorySingleCallsView.as_view(), name="history-single-calls"),
    path("api/v1/history/calls/<str:attempt_id>/", HistoryCallDetailView.as_view(), name="history-call-detail"),
    path("api/v1/history/calls/<str:attempt_id>/full/", HistoryCallFullView.as_view(), name="history-call-full"),
    path("api/v1/history/calls/<str:attempt_id>/transcript/", HistoryCallTranscriptView.as_view(), name="history-call-transcript"),

    # On-demand Live Analytics & Audio Recordings (Sarvam Analytics API)
    path("api/v1/history/live/attempts/", HistoryLiveAttemptsView.as_view(), name="history-live-attempts"),
    path("api/v1/history/live/interactions/", HistoryLiveInteractionsView.as_view(), name="history-live-interactions"),
    path("api/v1/history/interactions/<path:interaction_id>/transcript/", HistoryInteractionTranscriptView.as_view(), name="history-interaction-transcript"),
    path("api/v1/history/interactions/<path:interaction_id>/recording/", HistoryInteractionRecordingView.as_view(), name="history-interaction-recording"),
    path("api/v1/history/backfill/", HistoryBackfillView.as_view(), name="history-backfill"),
    path("api/v1/history/backfill/<str:job_id>/", HistoryBackfillStatusView.as_view(), name="history-backfill-status"),
    path("api/v1/history/qa/sample/", HistoryQASampleView.as_view(), name="history-qa-sample"),
    
    # Model router routes
    path("api/v1/", include(router.urls)),
]
