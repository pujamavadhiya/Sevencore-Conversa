"""
Single outbound call orchestrator for Sarvam Voice Agents (Instant Outbound).

Flow:  validate -> guard checks -> POST /outbounds -> wait for webhook
       -> classify outcome -> retry / finish -> fetch transcript

Credentials and URLs are loaded dynamically from environment variables (.env).
Run:  uvicorn sarvam_outbound:app --port 8000
"""
import asyncio
import os
import re
import uuid
from dataclasses import dataclass, field
from datetime import datetime, time as dtime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import quote
from zoneinfo import ZoneInfo

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, Field
import httpx

# ----------------------------- LOAD ENVIRONMENT -----------------------
# Search for .env in current directory, script parent directory, or backend directory
env_candidates = [
    Path.cwd() / ".env",
    Path(__file__).resolve().parent / ".env",
    Path(__file__).resolve().parent / "backend" / ".env",
    Path(__file__).resolve().parent.parent / "backend" / ".env",
    Path(__file__).resolve().parent.parent / ".env",
]
for candidate in env_candidates:
    if candidate.is_file():
        load_dotenv(candidate, override=False)
        break

# ----------------------------- CONFIG FROM ENV -------------------------
SARVAM_API_BASE_URL = os.getenv("SARVAM_API_BASE_URL", "https://apps.sarvam.ai").rstrip("/")
API_BASE = os.getenv("SARVAM_OUTBOUND_API_BASE") or (
    SARVAM_API_BASE_URL if SARVAM_API_BASE_URL.endswith("/api/outbounds") else f"{SARVAM_API_BASE_URL}/api/outbounds"
)
API_KEY = os.getenv("SARVAM_API_KEY", "").strip()
ORG_ID = os.getenv("SARVAM_ORG_ID", "").strip()
WORKSPACE_ID = os.getenv("SARVAM_WORKSPACE_ID", "").strip()
CONNECTION_ID = os.getenv("SARVAM_CONNECTION_ID", "").strip()
CALLER_NUMBER = os.getenv("SARVAM_AGENT_PHONE_NUMBER", "").strip()
WEBHOOK_URL = (
    os.getenv("SARVAM_WEBHOOK_URL", "").strip()
    or f"{os.getenv('BACKEND_PUBLIC_URL', 'http://localhost:8000').rstrip('/')}/sarvam/webhook"
)
WEBHOOK_SECRET = os.getenv("SARVAM_WEBHOOK_SECRET", "").strip()

DEFAULT_APP_ID = os.getenv("SARVAM_DEFAULT_APP_ID", "agent_sales_v1").strip()
DEFAULT_APP_VERSION = int(os.getenv("SARVAM_DEFAULT_APP_VERSION", "1"))

MAX_ATTEMPTS = int(os.getenv("SARVAM_MAX_ATTEMPTS", str(int(os.getenv("DEFAULT_MAX_RETRIES", "2")) + 1)))
RETRY_DELAYS_SEC = [
    int(s.strip()) for s in os.getenv("SARVAM_RETRY_DELAYS_SEC", "900,3600").split(",") if s.strip()
]
HTTP_TIMEOUT = float(os.getenv("HTTP_TIMEOUT", "15"))
WEBHOOK_WATCHDOG_SEC = int(os.getenv("WEBHOOK_WATCHDOG_SEC", str(20 * 60)))

CALLING_WINDOW_START_HOUR = int(os.getenv("CALLING_WINDOW_START_HOUR", "9"))
CALLING_WINDOW_END_HOUR = int(os.getenv("CALLING_WINDOW_END_HOUR", "20"))
CALL_WINDOW = (dtime(CALLING_WINDOW_START_HOUR, 0), dtime(CALLING_WINDOW_END_HOUR, 0))
CALLEE_TZ = ZoneInfo(os.getenv("TIME_ZONE", "Asia/Kolkata"))
E164 = re.compile(r"^\+[1-9]\d{7,14}$")


class State(str, Enum):
    CREATED = "created"
    DIALING = "dialing"            # API accepted, attempt_id received
    COMPLETED = "completed"        # connected, call ran and ended
    NO_ANSWER = "no_answer"
    BUSY = "busy"
    FAILED = "failed"
    UNKNOWN = "unknown"            # webhook never arrived
    REJECTED = "rejected"          # blocked by our own guards (bad number, DND, window)
    EXHAUSTED = "exhausted"        # out of retries


@dataclass
class CallJob:
    app_id: str                    # the agent you selected (its knowledge base comes with it)
    app_version: int
    phone: str
    variables: dict = field(default_factory=dict)   # e.g. {"user_name": "Asha"}
    opening_line: str | None = None
    job_id: str = field(default_factory=lambda: uuid.uuid4().hex)
    state: State = State.CREATED
    attempts: int = 0
    attempt_id: str | None = None
    interaction_id: str | None = None
    duration: float | None = None
    final_vars: dict | None = None
    history: list = field(default_factory=list)


JOBS: dict[str, CallJob] = {}          # In-memory store; replace with a DB table in prod
ATTEMPT_TO_JOB: dict[str, str] = {}    # attempt_id -> job_id
SEEN_WEBHOOKS: set[str] = set()        # idempotency (use DB unique key in prod)
DND_LIST: set[str] = set()             # DND / suppression phone number lookup


# --------------------------- GUARD CHECKS -----------------------------
def guard(job: CallJob, bypass_window: bool = False) -> str | None:
    """Return a rejection reason, or None if OK to dial."""
    if not E164.match(job.phone):
        return "invalid_phone_format"
    if job.phone in DND_LIST:
        return "do_not_call"
    if not bypass_window:
        now = datetime.now(CALLEE_TZ).time()
        if not (CALL_WINDOW[0] <= now <= CALL_WINDOW[1]):
            return "outside_call_window"
    if any(
        j.phone == job.phone and j.state == State.DIALING and j.job_id != job.job_id
        for j in JOBS.values()
    ):
        return "call_already_in_progress"
    return None


# --------------------------- DIAL ATTEMPT -----------------------------
async def place_call(job: CallJob) -> None:
    job.attempts += 1

    # Validate essential environment credentials
    missing_creds = []
    if not API_KEY:
        missing_creds.append("SARVAM_API_KEY")
    if not ORG_ID:
        missing_creds.append("SARVAM_ORG_ID")
    if not WORKSPACE_ID:
        missing_creds.append("SARVAM_WORKSPACE_ID")
    if not CONNECTION_ID:
        missing_creds.append("SARVAM_CONNECTION_ID")
    if not CALLER_NUMBER:
        missing_creds.append("SARVAM_AGENT_PHONE_NUMBER")

    if missing_creds:
        err_msg = f"Missing env configuration: {', '.join(missing_creds)}"
        job.state = State.FAILED
        job.history.append(("config_error", err_msg))
        return

    app_config: Dict[str, Any] = {
        "app_id": job.app_id,
        "app_version": job.app_version,
        "connection_config": {
            "connection_id": CONNECTION_ID,
            "agent_phone_number": CALLER_NUMBER,
        },
    }
    if job.opening_line:
        app_config["app_overrides"] = {"initial_bot_message": job.opening_line}
    if job.variables:
        app_config["agent_variables"] = job.variables

    webhook_config: Dict[str, Any] = {"url": WEBHOOK_URL}
    if WEBHOOK_SECRET:
        webhook_config["headers"] = {"X-Webhook-Secret": WEBHOOK_SECRET}

    payload = {
        "app_config": app_config,
        "user_config": {"user_phone_number": job.phone},
        "webhook_config": webhook_config,
    }
    url = f"{API_BASE}/v1/orgs/{ORG_ID}/workspaces/{WORKSPACE_ID}/outbounds"
    headers = {"X-API-Key": API_KEY, "Content-Type": "application/json"}

    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as c:
            r = await c.post(url, json=payload, headers=headers)
    except (httpx.TimeoutException, httpx.TransportError) as e:
        # Network error: we do NOT know if the call was created. Don't blindly retry
        # immediately; it risks double-calling the person. Mark and retry with delay.
        job.history.append(("api_network_error", str(e)))
        return await schedule_retry(job, reason="api_network_error")

    if r.status_code == 200:
        data = r.json()
        job.attempt_id = data.get("attempt_id")
        if job.attempt_id:
            ATTEMPT_TO_JOB[job.attempt_id] = job.job_id
        job.state = State.DIALING
        job.history.append(("dialing", job.attempt_id))
        if job.attempt_id:
            asyncio.create_task(watchdog(job.job_id, job.attempt_id))
    elif r.status_code in (401, 403):
        job.state = State.FAILED                      # config problem, retry is pointless
        job.history.append(("auth_error", r.text))
    elif r.status_code == 422:
        job.state = State.FAILED                      # bad payload / bad number
        job.history.append(("validation_error", r.text))
    elif r.status_code == 429 or r.status_code >= 500:
        job.history.append((f"api_{r.status_code}", r.text))
        await schedule_retry(job, reason=f"api_{r.status_code}")
    else:
        job.state = State.FAILED
        job.history.append((f"api_{r.status_code}", r.text))


async def schedule_retry(job: CallJob, reason: str) -> None:
    if job.attempts >= MAX_ATTEMPTS:
        job.state = State.EXHAUSTED
        job.history.append(("exhausted", reason))
        return
    delay = RETRY_DELAYS_SEC[min(job.attempts - 1, len(RETRY_DELAYS_SEC) - 1)]
    job.history.append(("retry_scheduled", f"{reason} in {delay}s"))
    await asyncio.sleep(delay)   # in production use a durable scheduler/queue
    block = guard(job)           # re-check DND / window before every redial
    if block:
        job.state = State.REJECTED
        job.history.append(("rejected_on_retry", block))
        return
    await place_call(job)


# ---------------------------- WATCHDOG --------------------------------
async def watchdog(job_id: str, attempt_id: str) -> None:
    """Backstop if the webhook is lost. Does not hang up the call (the platform owns that)."""
    await asyncio.sleep(WEBHOOK_WATCHDOG_SEC)
    job = JOBS.get(job_id)
    if job and job.attempt_id == attempt_id and job.state == State.DIALING:
        job.state = State.UNKNOWN
        job.history.append(("webhook_timeout", attempt_id))
        # Reconcile via Sarvam analytics / alert ops. Do not auto-redial: call may have happened.


# ----------------------- POST CALL PROCESSING -------------------------
async def post_call_processing(job: CallJob) -> None:
    """Pull transcript/recording with interaction_id via Sarvam's Analytics API, update CRM."""
    if not job.interaction_id or not job.app_id:
        return
    try:
        encoded_id = quote(job.interaction_id, safe="")
        analytics_base = SARVAM_API_BASE_URL.rstrip("/")
        url = f"{analytics_base}/api/analytics/v1/{ORG_ID}/{WORKSPACE_ID}/{job.app_id}/transcripts/{encoded_id}"
        headers = {"X-API-Key": API_KEY}
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as c:
            r = await c.get(url, headers=headers)
            if r.status_code == 200:
                transcript_data = r.json()
                job.history.append(("transcript_fetched", transcript_data))
            else:
                job.history.append(("transcript_fetch_error", f"HTTP {r.status_code}: {r.text}"))
    except Exception as exc:
        job.history.append(("transcript_fetch_exception", str(exc)))


# ---------------------------- FASTAPI APP -----------------------------
app = FastAPI(
    title="Sarvam Instant Outbound Call Orchestrator",
    description="Single outbound call orchestrator for Sarvam Voice Agents with env-driven config and retry guards.",
    version="1.0.0",
)


class CallRequest(BaseModel):
    phone: str = Field(..., description="E.164 formatted phone number (e.g. +919876543210)")
    app_id: Optional[str] = Field(None, description="Sarvam agent app_id. Defaults to env SARVAM_DEFAULT_APP_ID")
    app_version: Optional[int] = Field(None, description="App version. Defaults to env SARVAM_DEFAULT_APP_VERSION")
    variables: Dict[str, Any] = Field(default_factory=dict, description="Variables passed to Sarvam agent")
    opening_line: Optional[str] = Field(None, description="Initial greeting/bot message override")
    bypass_window: bool = Field(False, description="Set True to bypass telecom call window (for testing)")


@app.get("/")
def root():
    return {
        "service": "Sarvam Instant Outbound Orchestrator",
        "status": "online",
        "api_base": API_BASE,
        "caller_number": CALLER_NUMBER,
        "webhook_url": WEBHOOK_URL,
        "calling_window": f"{CALLING_WINDOW_START_HOUR:02d}:00 - {CALLING_WINDOW_END_HOUR:02d}:00 IST",
    }


@app.get("/config")
def get_config():
    """Inspect active env credentials configuration (masked for security)."""
    return {
        "api_base": API_BASE,
        "api_key_configured": bool(API_KEY),
        "api_key_masked": f"{API_KEY[:4]}...{API_KEY[-4:]}" if len(API_KEY) >= 8 else "***",
        "org_id": ORG_ID,
        "workspace_id": WORKSPACE_ID,
        "connection_id": CONNECTION_ID,
        "caller_number": CALLER_NUMBER,
        "webhook_url": WEBHOOK_URL,
        "webhook_secret_configured": bool(WEBHOOK_SECRET),
        "default_app_id": DEFAULT_APP_ID,
        "default_app_version": DEFAULT_APP_VERSION,
        "calling_window_hours": f"{CALLING_WINDOW_START_HOUR:02d}:00 - {CALLING_WINDOW_END_HOUR:02d}:00",
        "timezone": str(CALLEE_TZ),
        "max_attempts": MAX_ATTEMPTS,
        "retry_delays_sec": RETRY_DELAYS_SEC,
    }


@app.post("/calls")
async def create_call(body: CallRequest):
    app_id = body.app_id or DEFAULT_APP_ID
    app_version = body.app_version or DEFAULT_APP_VERSION

    job = CallJob(
        app_id=app_id,
        app_version=app_version,
        phone=body.phone,
        variables=body.variables,
        opening_line=body.opening_line,
    )
    JOBS[job.job_id] = job

    block = guard(job, bypass_window=body.bypass_window)
    if block:
        job.state = State.REJECTED
        job.history.append(("rejected", block))
        return {
            "job_id": job.job_id,
            "state": job.state,
            "reason": block,
            "phone": job.phone,
        }

    await place_call(job)
    return {
        "job_id": job.job_id,
        "state": job.state,
        "attempt_id": job.attempt_id,
        "history": job.history,
    }


@app.post("/sarvam/webhook")
async def webhook(req: Request):
    if WEBHOOK_SECRET:
        secret = req.headers.get("X-Webhook-Secret") or req.query_params.get("secret")
        if secret != WEBHOOK_SECRET:
            raise HTTPException(status_code=401, detail="Unauthorized: invalid webhook secret")

    try:
        p = await req.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Malformed JSON payload")

    attempt_id = p.get("attempt_id")
    if not attempt_id:
        return {"ok": True, "warning": "missing attempt_id"}

    if attempt_id in SEEN_WEBHOOKS:                    # duplicate delivery
        return {"ok": True, "duplicate": True}
    SEEN_WEBHOOKS.add(attempt_id)

    job = JOBS.get(ATTEMPT_TO_JOB.get(attempt_id, ""))
    if not job:
        return {"ok": True, "unmatched": True}          # unknown attempt: ack, don't retry-storm

    status_val = p.get("status")                       # connected | no_answer | busy | failed
    job.duration = p.get("duration")
    job.interaction_id = p.get("interaction_id")
    job.final_vars = p.get("final_agent_variables")
    job.history.append(("webhook", status_val))

    if status_val == "connected":
        job.state = State.COMPLETED
        # Classify what happened from duration + variables:
        # - very short duration  -> callee likely hung up / voicemail
        # - final_vars flag      -> agent set e.g. call_outcome="silent_disconnect"
        asyncio.create_task(post_call_processing(job))
    elif status_val in ("no_answer", "busy"):
        job.state = State.NO_ANSWER if status_val == "no_answer" else State.BUSY
        asyncio.create_task(schedule_retry(job, reason=status_val))
    else:  # failed (carrier error, invalid number, etc.)
        job.state = State.FAILED
        # Retry once for transient carrier failures only; permanent ones stop here.
        if job.attempts < 2:
            asyncio.create_task(schedule_retry(job, reason="failed"))

    return {"ok": True, "job_id": job.job_id, "state": job.state}


@app.get("/calls")
def list_calls():
    return [
        {
            "job_id": j.job_id,
            "phone": j.phone,
            "state": j.state,
            "attempts": j.attempts,
            "attempt_id": j.attempt_id,
            "duration": j.duration,
            "interaction_id": j.interaction_id,
        }
        for j in JOBS.values()
    ]


@app.get("/calls/{job_id}")
async def get_call(job_id: str):
    j = JOBS.get(job_id)
    if not j:
        raise HTTPException(status_code=404, detail="CallJob not found")
    return {
        "job_id": j.job_id,
        "app_id": j.app_id,
        "app_version": j.app_version,
        "phone": j.phone,
        "state": j.state,
        "attempts": j.attempts,
        "attempt_id": j.attempt_id,
        "interaction_id": j.interaction_id,
        "duration": j.duration,
        "final_vars": j.final_vars,
        "history": j.history,
    }
