"""
On-demand full call history from Sarvam's Analytics API (attempts, interactions, transcripts,
recordings) layered on top of sarvam_history.py.

Run: uvicorn sarvam_history:app --port 8003
"""
from backend.sarvam_ondemand import (
    router,
    init_ondemand_db,
    list_page,
    iter_pages,
    normalize_interaction,
    upsert_interaction,
    sync_interactions,
    download_recording,
    download_pending_recordings,
    call_full,
    interaction_transcript,
    interaction_recording,
    start_backfill,
    backfill_status,
    qa_sample,
)

__all__ = [
    "router",
    "init_ondemand_db",
    "list_page",
    "iter_pages",
    "normalize_interaction",
    "upsert_interaction",
    "sync_interactions",
    "download_recording",
    "download_pending_recordings",
    "call_full",
    "interaction_transcript",
    "interaction_recording",
    "start_backfill",
    "backfill_status",
    "qa_sample",
]

