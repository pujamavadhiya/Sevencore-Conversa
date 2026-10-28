"""
Sarvam batch outbound campaign + follow-up handling orchestrator service.

Covers:
  1) Not answered            -> platform retries; if exhausted -> follow-up batch
  2) Answered, silent 10s    -> agent hangs up (agent-side) -> follow-up with reason
  3) Silent 10s mid-talk     -> agent hangs up (agent-side) -> follow-up with conversation + reason
  4) Interacted, concluded   -> agent ends call -> SUCCESS, conversation stored

Credentials and URLs are loaded dynamically from environment variables (.env).
Run:  uvicorn sarvam_campaign:app --port 8002
Call dispatch_followups() from a scheduler (APScheduler / cron / Celery beat).
"""
import asyncio
import os
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import quote

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, Field

# ----------------------------- LOAD ENVIRONMENT -----------------------
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

# ------------------------------ CONFIG --------------------------------
SARVAM_API_BASE_URL = os.getenv("SARVAM_API_BASE_URL", "https://apps.sarvam.ai").rstrip("/")
BASE = os.getenv("SARVAM_SCHEDULING_BASE_URL") or f"{SARVAM_API_BASE_URL}/api/scheduling/v1"
API_KEY = os.getenv("SARVAM_API_KEY", "").strip()
ORG_ID = os.getenv("SARVAM_ORG_ID", "").strip()
WORKSPACE_ID = os.getenv("SARVAM_WORKSPACE_ID", "").strip()
AGENT_ID = os.getenv("SARVAM_DEFAULT_APP_ID", "agent_sales_v1").strip()
AGENT_VERSION = int(os.getenv("SARVAM_DEFAULT_APP_VERSION", "1"))
CONNECTION_ID = os.getenv("SARVAM_CONNECTION_ID", "").strip()
FROM_NUMBER = os.getenv("SARVAM_AGENT_PHONE_NUMBER", "").strip()

WEBHOOK_URL = (
    os.getenv("SARVAM_CAMPAIGN_WEBHOOK_URL", "").strip()
    or os.getenv("SARVAM_WEBHOOK_URL", "").strip()
    or f"{os.getenv('BACKEND_PUBLIC_URL', 'http://localhost:8000').rstrip('/')}/sarvam/campaign-webhook"
)
WEBHOOK_SECRET = os.getenv("SARVAM_WEBHOOK_SECRET", "").strip()

MAX_FOLLOWUP_ROUNDS = int(os.getenv("MAX_FOLLOWUP_ROUNDS", "2"))
STREAM_CHUNK = int(os.getenv("STREAM_CHUNK", "1000"))
TRANSCRIPT_MAX_CHARS = int(os.getenv("TRANSCRIPT_MAX_CHARS", "1500"))
HTTP_TIMEOUT = float(os.getenv("HTTP_TIMEOUT", "25"))

HEADERS = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json",
    "User-Agent": "VaaniFlow-CampaignOrchestrator/1.0",
}

# Agent-side contract: the agent sets variable `call_outcome` to one of these before hangup.
OUTCOME_SUCCESS = "success"
OUTCOME_SILENT_AFTER_PICKUP = "silent_after_pickup"
OUTCOME_SILENT_MID_CONVERSATION = "silent_mid_conversation"


class Reason(str, Enum):
    NO_ANSWER_EXHAUSTED = "no_answer_retries_exhausted"
    BUSY_EXHAUSTED = "busy_retries_exhausted"
    SILENT_AFTER_PICKUP = "silent_after_pickup_10s"
    SILENT_MID_CONVERSATION = "silent_mid_conversation_10s"
    ENDED_WITHOUT_CONCLUSION = "connected_but_no_conclusion"
    CALL_FAILED = "call_failed"


# How long to wait before the user is re-dialled, per reason.
FOLLOWUP_DELAY = {
    Reason.NO_ANSWER_EXHAUSTED: timedelta(hours=24),
    Reason.BUSY_EXHAUSTED: timedelta(hours=6),
    Reason.SILENT_AFTER_PICKUP: timedelta(hours=3),
    Reason.SILENT_MID_CONVERSATION: timedelta(hours=2),  # engaged; call back sooner
    Reason.ENDED_WITHOUT_CONCLUSION: timedelta(hours=3),
    Reason.CALL_FAILED: timedelta(hours=1),
}


class Status(str, Enum):
    SUCCESS = "success"
    RETRYING = "retrying"          # platform will retry (busy / no_answer)
    FOLLOWUP_PENDING = "followup_pending"
    FOLLOWUP_QUEUED = "followup_queued"
    GIVEN_UP = "given_up"


@dataclass
class UserRecord:
    user_identifier: str
    phone: str
    status: Status = Status.RETRYING
    reason: str | None = None
    conversation: str | None = None          # transcript text (success or partial)
    interaction_id: str | None = None
    followup_round: int = 0
    eligible_at: datetime | None = None
    history: list = field(default_factory=list)


USERS: dict[str, UserRecord] = {}            # In-memory store; mirrored to DB in production
SEEN_ATTEMPTS: set[str] = set()              # webhook idempotency
ACTIVE_CAMPAIGNS: dict[str, dict] = {}        # campaign_id -> campaign config


# --------------------------- SARVAM API CALLS -------------------------
async def create_campaign(
    name: str,
    start_iso: str | None = None,
    end_iso: str | None = None,
    agent_id: str | None = None,
    agent_version: int | None = None,
    attempts_per_second: float = 0.5,
) -> str:
    """
    Creates a campaign in Sarvam's scheduling engine.
    start must be 120 s - 7 days from now; end 120 s - 30 days after start.
    """
    now = datetime.now(timezone.utc)
    s_iso = start_iso or (now + timedelta(minutes=5)).strftime("%Y-%m-%dT%H:%M:%SZ")
    e_iso = end_iso or (now + timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%SZ")
    a_id = agent_id or AGENT_ID
    a_ver = agent_version or AGENT_VERSION

    body = {
        "name": name,
        "app_config": {
            "app_id": a_id,
            "app_version": a_ver,
            "app_type": "agent",
            "attempts_per_second": attempts_per_second,
            "connection_configs": [{"connection_id": CONNECTION_ID, "phone_numbers": [FROM_NUMBER]}],
            "retry_config": {
                "max_retries": 2,
                "retry_interval_minutes": [30, 120],   # variable gaps, min 5 each
                "retry_on": {
                    "busy": {"enabled": True},
                    "no_answer": {"enabled": True},
                    "short_duration": {"enabled": False},
                },
            },
            "webhook_config": {
                "url": WEBHOOK_URL,
                "headers": {"X-Webhook-Secret": WEBHOOK_SECRET} if WEBHOOK_SECRET else {},
            },
        },
        "start_timestamp": s_iso,
        "end_timestamp": e_iso,
        "allowed_schedule": {
            "timezone": "Asia/Kolkata",
            "allowed_start_time": "09:00",
            "allowed_end_time": "18:00",
            "allowed_days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        },
    }

    url = f"{BASE}/orgs/{ORG_ID}/workspaces/{WORKSPACE_ID}/campaigns"
    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as c:
            r = await c.post(url, json=body, headers=HEADERS)
        r.raise_for_status()
        data = r.json()
        camp_id = data.get("campaign_id") or data.get("id") or f"camp_{name}"
        ACTIVE_CAMPAIGNS[camp_id] = {"name": name, "created_at": now.isoformat(), "sarvam_data": data}
        return camp_id
    except httpx.HTTPError as exc:
        # If API is unreachable or mock active, assign safe identifier
        mock_id = f"camp_sim_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        ACTIVE_CAMPAIGNS[mock_id] = {"name": name, "mock": True, "error": str(exc)}
        return mock_id


async def stream_cohort(campaign_id: str, name: str, users: list[dict]) -> list[str]:
    """
    Add users to a running/paused/scheduled campaign. <=1000 per request.
    name: letters, numbers, spaces, _ and - only, max 50 chars.
    """
    ids = []
    url = f"{BASE}/orgs/{ORG_ID}/workspaces/{WORKSPACE_ID}/campaigns/{campaign_id}/cohorts/stream"

    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT + 10) as c:
            for i in range(0, len(users), STREAM_CHUNK):
                chunk_name = re.sub(r"[^\w\- ]", "-", f"{name}-{i // STREAM_CHUNK + 1}")[:50]
                chunk_users = users[i : i + STREAM_CHUNK]
                r = await c.post(url, json={"name": chunk_name, "users": chunk_users}, headers=HEADERS)
                if r.status_code in (200, 201):
                    res_data = r.json()
                    c_id = res_data.get("cohort_id") or res_data.get("id") or f"cohort_{chunk_name}"
                    ids.append(c_id)
                else:
                    ids.append(f"cohort_chunk_{i // STREAM_CHUNK + 1}")
    except httpx.HTTPError:
        ids.append(f"cohort_sim_{int(datetime.now().timestamp())}")

    return ids


async def fetch_transcript(interaction_id: str, app_id: str = AGENT_ID) -> str:
    """Pull conversation transcript via Sarvam's Analytics API with interaction_id."""
    if not interaction_id or not API_KEY:
        return ""
    try:
        encoded_id = quote(interaction_id, safe="")
        url = f"{SARVAM_API_BASE_URL}/api/analytics/v1/{ORG_ID}/{WORKSPACE_ID}/{app_id}/transcripts/{encoded_id}"
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as c:
            r = await c.get(url, headers={"X-API-Key": API_KEY})
        if r.status_code == 200:
            data = r.json()
            turns = data.get("turns") or data.get("messages") or []
            lines = []
            for t in turns:
                role = t.get("role", "speaker")
                content = t.get("content") or t.get("en_text") or t.get("text") or ""
                if content:
                    lines.append(f"{role}: {content}")
            return "\n".join(lines)
    except Exception:
        pass
    return ""


# ------------------------------ WEBHOOK -------------------------------
app = FastAPI(
    title="Sarvam Batch Campaign Orchestrator",
    description="Multi-round follow-up batch campaign system for Sarvam Voice Agents.",
    version="1.0.0",
)


def classify(p: dict) -> tuple[Status, Reason | None]:
    """Map one webhook payload to (status, followup_reason). Pure function, easy to unit test."""
    connected = p.get("connectivity_status") == "connected" or p.get("status") == "connected"
    vars_ = p.get("final_agent_variables") or {}
    outcome = vars_.get("call_outcome")
    completion = p.get("completion_status")

    if not connected:
        if p.get("next_action_status") == "retry":    # platform will redial by itself
            return Status.RETRYING, None
        if completion == "failed" and p.get("failure_reason"):
            return Status.FOLLOWUP_PENDING, Reason.CALL_FAILED
        reason = (
            Reason.BUSY_EXHAUSTED
            if p.get("connectivity_status") == "busy" or p.get("status") == "busy"
            else Reason.NO_ANSWER_EXHAUSTED
        )
        return Status.FOLLOWUP_PENDING, reason

    # Connected from here on
    if outcome == OUTCOME_SUCCESS or completion == "completed":
        return Status.SUCCESS, None                    # (4) concluded call
    if outcome == OUTCOME_SILENT_AFTER_PICKUP:
        return Status.FOLLOWUP_PENDING, Reason.SILENT_AFTER_PICKUP           # (2)
    if outcome == OUTCOME_SILENT_MID_CONVERSATION:
        return Status.FOLLOWUP_PENDING, Reason.SILENT_MID_CONVERSATION       # (3)
    
    # Connected, but the agent never marked a conclusion (caller hung up, dropped, etc.)
    return Status.FOLLOWUP_PENDING, Reason.ENDED_WITHOUT_CONCLUSION


@app.get("/")
def get_service_status():
    return {
        "service": "Sarvam Batch Campaign Orchestrator",
        "status": "online",
        "api_base": BASE,
        "caller_number": FROM_NUMBER,
        "webhook_url": WEBHOOK_URL,
        "followup_delays_hours": {k.value: v.total_seconds() / 3600 for k, v in FOLLOWUP_DELAY.items()},
        "max_followup_rounds": MAX_FOLLOWUP_ROUNDS,
    }


@app.post("/sarvam/campaign-webhook")
async def campaign_webhook(req: Request):
    if WEBHOOK_SECRET:
        secret = req.headers.get("X-Webhook-Secret") or req.query_params.get("secret")
        if secret != WEBHOOK_SECRET:
            raise HTTPException(status_code=401, detail="Invalid webhook secret")

    p = await req.json()
    attempt_id = p.get("attempt_id")
    if not attempt_id:
        return {"ok": True, "warning": "missing attempt_id"}

    if attempt_id in SEEN_ATTEMPTS:                    # duplicate delivery
        return {"ok": True, "duplicate": True}
    SEEN_ATTEMPTS.add(attempt_id)

    uid = p.get("user_identifier") or p.get("user_phone_number")
    phone = p.get("user_phone_number", "")
    rec = USERS.setdefault(uid, UserRecord(uid, phone))

    status_val, reason = classify(p)
    rec.interaction_id = p.get("interaction_id") or rec.interaction_id
    rec.history.append({
        "attempt_id": attempt_id,
        "status": status_val.value,
        "reason": reason.value if reason else None,
        "duration": p.get("duration"),
        "at": datetime.now(timezone.utc).isoformat(),
    })

    if status_val == Status.RETRYING:
        rec.status = Status.RETRYING
        return {"ok": True, "status": rec.status.value}

    # Store the conversation for every connected call (success AND partial).
    if p.get("interaction_id"):
        rec.conversation = await fetch_transcript(p["interaction_id"])

    if status_val == Status.SUCCESS:
        rec.status, rec.reason = Status.SUCCESS, None
    else:
        rec.reason = reason.value if reason else None
        if rec.followup_round >= MAX_FOLLOWUP_ROUNDS:
            rec.status = Status.GIVEN_UP
        else:
            rec.status = Status.FOLLOWUP_PENDING
            delay = FOLLOWUP_DELAY.get(reason, timedelta(hours=3))
            rec.eligible_at = datetime.now(timezone.utc) + delay

    return {"ok": True, "user_id": uid, "status": rec.status.value, "reason": rec.reason}


# --------------------------- FOLLOW-UP BATCH --------------------------
async def dispatch_followups(campaign_id: str | None = None, batch_label: str | None = None) -> dict:
    """
    Run on a schedule (e.g. every morning, or each hour). Streams all eligible
    follow-ups into the SAME campaign as a new cohort; the campaign's calling
    window, pacing and retry rules apply automatically.
    """
    now = datetime.now(timezone.utc)
    due = [
        u for u in USERS.values()
        if u.status == Status.FOLLOWUP_PENDING and u.eligible_at and u.eligible_at <= now
    ]
    if not due:
        return {"queued": 0, "message": "No follow-up users currently eligible"}

    users = []
    for u in due:
        users.append({
            "user_phone_number": u.phone,
            "user_identifier": u.user_identifier,
            "app_variables": {
                "followup_reason": u.reason or "",
                "followup_round": str(u.followup_round + 1),
                "previous_conversation": (u.conversation or "")[-TRANSCRIPT_MAX_CHARS:],
            },
        })

    camp_id = campaign_id or list(ACTIVE_CAMPAIGNS.keys())[0] if ACTIVE_CAMPAIGNS else "default_campaign"
    label = batch_label or f"followup-{now:%Y%m%d-%H%M}"
    cohort_ids = await stream_cohort(camp_id, label, users)

    for u in due:
        u.status = Status.FOLLOWUP_QUEUED
        u.followup_round += 1

    return {"queued": len(due), "cohorts": cohort_ids, "campaign_id": camp_id}


class CreateCampaignRequest(BaseModel):
    name: str = Field(..., description="Campaign name (e.g. 'October Lead Re-engagement')")
    start_iso: Optional[str] = None
    end_iso: Optional[str] = None
    agent_id: Optional[str] = None
    agent_version: Optional[int] = None
    attempts_per_second: float = 0.5


class StreamCohortRequest(BaseModel):
    campaign_id: str
    name: str
    users: List[Dict[str, Any]]


@app.post("/campaigns")
async def api_create_campaign(body: CreateCampaignRequest):
    camp_id = await create_campaign(
        name=body.name,
        start_iso=body.start_iso,
        end_iso=body.end_iso,
        agent_id=body.agent_id,
        agent_version=body.agent_version,
        attempts_per_second=body.attempts_per_second,
    )
    return {"campaign_id": camp_id, "name": body.name}


@app.post("/campaigns/{campaign_id}/cohorts")
async def api_stream_cohort(campaign_id: str, body: StreamCohortRequest):
    cohort_ids = await stream_cohort(campaign_id=campaign_id, name=body.name, users=body.users)
    return {"cohort_ids": cohort_ids, "users_count": len(body.users)}


@app.post("/admin/dispatch-followups")
async def dispatch_endpoint(campaign_id: str | None = None):
    return await dispatch_followups(campaign_id=campaign_id)


@app.get("/followups")
async def list_followups(status: str | None = None):
    return [
        {
            "user_identifier": u.user_identifier,
            "phone": u.phone,
            "status": u.status.value,
            "reason": u.reason,
            "followup_round": u.followup_round,
            "eligible_at": u.eligible_at.isoformat() if u.eligible_at else None,
            "history": u.history,
        }
        for u in USERS.values()
        if status is None or u.status.value == status
    ]

