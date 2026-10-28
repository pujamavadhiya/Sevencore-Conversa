"""
Sarvam Call History & Transcript Pipeline.
Keeps single calls and batch campaigns strictly separated.
"""
from backend.sarvam_history import (
    app,
    router,
    init_db,
    start_workers,
    ingest_webhook,
    register_campaign,
    pull_transcript,
    sync_attempts,
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("sarvam_history:app", host="0.0.0.0", port=8003, reload=True)

