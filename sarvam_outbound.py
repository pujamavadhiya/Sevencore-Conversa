"""
Single outbound call orchestrator for Sarvam Voice Agents (Instant Outbound).

Flow:  validate -> guard checks -> POST /outbounds -> wait for webhook
       -> classify outcome -> retry / finish -> fetch transcript

Credentials and URLs are loaded dynamically from environment variables (.env).
Run:  uvicorn sarvam_outbound:app --port 8000
"""
from backend.sarvam_outbound import app, CallJob, State, JOBS, ATTEMPT_TO_JOB, SEEN_WEBHOOKS

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("sarvam_outbound:app", host="0.0.0.0", port=8001, reload=True)
