"""
Call history + transcript pipeline for Sarvam (single calls AND campaigns, kept separate).

Data flow
  webhook ──► ingest_webhook() ─┐
                                ├─► calls table (one row per attempt, upsert by attempt_id)
  Analytics /attempts ──► sync ─┘            │
                                             ▼
  transcript worker ──► Analytics /transcripts/{interaction_id} ──► transcripts table

History API (what your UI reads)
  GET /history/campaigns                              -> one entry per campaign (the "History" list)
  GET /history/campaigns/{campaign_id}/calls          -> click a campaign: all its calls
  GET /history/campaigns/{campaign_id}/users/{uid}    -> every attempt for one user in that campaign
  GET /history/single-calls                           -> single (instant) calls only
  GET /history/calls/{attempt_id}                     -> one call with its transcript
  GET /history/calls/{attempt_id}/transcript          -> transcript text (fetched on demand if missing)

Credentials and URLs are loaded dynamically from environment variables (.env).
Run:  uvicorn sarvam_history:app --port 8003
"""
import asyncio
import json
import logging
import os
import re
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import quote

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException, Query

log = logging.getLogger("history")

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
BASE_DIR = Path(__file__).resolve().parent
DB_PATH = os.getenv("HISTORY_DB_PATH") or str(BASE_DIR / "history.db")
ANALYTICS_HOST = os.getenv("SARVAM_API_BASE_URL", "https://apps.sarvam.ai").rstrip("/")
ANALYTICS_BASE = f"{ANALYTICS_HOST}/api/analytics/v1"
API_KEY = os.getenv("SARVAM_API_KEY", "").strip()
ORG_ID = os.getenv("SARVAM_ORG_ID", "").strip()
WORKSPACE_ID = os.getenv("SARVAM_WORKSPACE_ID", "").strip()
DEFAULT_AGENT_ID = os.getenv("SARVAM_DEFAULT_APP_ID", "agent_sales_v1").strip()
HEADERS = {"X-API-Key": API_KEY, "Content-Type": "application/json"}

TRANSCRIPT_RETRY_DELAYS = [30, 120, 600, 1800, 7200]   # seconds; then mark 'unavailable'
SYNC_OVERLAP = timedelta(minutes=5)                    # overlap windows so boundary rows aren't missed
SYNC_FIRST_LOOKBACK = timedelta(hours=24)
SYNC_INTERVAL_SEC = 600
TRANSCRIPT_INTERVAL_SEC = 30
PAGE_LIMIT = 1000                                      # API max

# ------------------------------- SCHEMA -------------------------------
SCHEMA = """
CREATE TABLE IF NOT EXISTS campaigns (
  campaign_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  agent_id TEXT,
  start_timestamp TEXT,
  end_timestamp TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS calls (
  attempt_id TEXT PRIMARY KEY,
  call_type TEXT NOT NULL CHECK (call_type IN ('single','campaign')),
  campaign_id TEXT,
  cohort_id TEXT,
  agent_id TEXT,
  interaction_id TEXT,
  user_identifier TEXT,
  external_ref TEXT,               -- external_ref: internal id for calls
  user_contact_masked TEXT,        -- raw numbers are masked for privacy
  connectivity_status TEXT,
  completion_status TEXT,
  next_action_status TEXT,
  disposition TEXT,                -- success | retrying | followup | not_connected | unknown
  followup_reason TEXT,
  call_outcome TEXT,
  failure_reason TEXT,
  duration REAL,
  retry_attempt INTEGER,
  executed_at TEXT,
  agent_variables TEXT,            -- JSON string
  is_debug_call INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL,            -- 'webhook' or 'sync'
  transcript_status TEXT NOT NULL DEFAULT 'pending',  -- not_applicable|pending|ready|unparsed|unavailable
  transcript_attempts INTEGER NOT NULL DEFAULT 0,
  transcript_next_try_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_calls_campaign ON calls(campaign_id, executed_at);
CREATE INDEX IF NOT EXISTS ix_calls_type ON calls(call_type, executed_at);
CREATE INDEX IF NOT EXISTS ix_calls_user ON calls(campaign_id, user_identifier);
CREATE INDEX IF NOT EXISTS ix_calls_tx ON calls(transcript_status, transcript_next_try_at);

CREATE TABLE IF NOT EXISTS transcripts (
  interaction_id TEXT PRIMARY KEY,
  attempt_id TEXT,
  raw_json TEXT,
  text TEXT,
  fetched_at TEXT
);

CREATE TABLE IF NOT EXISTS sync_state (
  key TEXT PRIMARY KEY,
  value TEXT
);
"""


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with db() as c:
        c.executescript(SCHEMA)
    # Seed existing data from Django SQLite database if present
    seed_from_django_if_empty()


# ----------------------------- NORMALIZERS ----------------------------
def mask_phone(n: str | None) -> str | None:
    if not n:
        return None
    cleaned = re.sub(r"\s+", "", str(n))
    if len(cleaned) <= 5:
        return cleaned[:2] + "***"
    return cleaned[:3] + "X" * max(len(cleaned) - 5, 0) + cleaned[-2:]


def derive_disposition(r: dict) -> tuple[str, str | None]:
    """Single source of truth for success/follow-up."""
    conn = r.get("connectivity_status")
    if conn is None:
        return "unknown", None
    if conn != "connected":
        if r.get("next_action_status") == "retry":
            return "retrying", None
        if r.get("next_action_status") is None:
            return "not_connected", None          # e.g. sync row: can't tell if a retry is pending
        if r.get("completion_status") == "failed":
            return "followup", "call_failed"
        return "followup", ("busy_retries_exhausted" if conn == "busy" else "no_answer_retries_exhausted")
    outcome = r.get("call_outcome")
    if outcome == "success" and r.get("completion_status") in (None, "completed"):
        return "success", None
    if outcome == "silent_after_pickup":
        return "followup", "silent_after_pickup_10s"
    if outcome == "silent_mid_conversation":
        return "followup", "silent_mid_conversation_10s"
    return "followup", "connected_but_no_conclusion"


def normalize_webhook(p: dict) -> dict:
    """Handles both the instant-outbound webhook (status=...) and the campaign webhook."""
    vars_ = p.get("final_agent_variables") or p.get("agent_variables") or {}
    conn = p.get("connectivity_status") or p.get("status")
    comp = p.get("completion_status") or ("completed" if conn == "connected" else None)
    meta = p.get("metadata") or (p.get("webhook_config") or {}).get("metadata") or {}
    campaign_id = (
        p.get("campaign_id")
        or meta.get("campaign_id")
        or (str(meta.get("campaign_id")) if meta.get("campaign_id") else None)
    )
    if campaign_id:
        campaign_id = str(campaign_id)

    rec = {
        "attempt_id": str(p.get("attempt_id")),
        "call_type": "campaign" if campaign_id else "single",
        "campaign_id": campaign_id,
        "cohort_id": p.get("cohort_id") or meta.get("cohort_id"),
        "agent_id": p.get("app_id") or meta.get("agent_id") or DEFAULT_AGENT_ID,
        "interaction_id": p.get("interaction_id"),
        "user_identifier": p.get("user_identifier") or meta.get("user_identifier") or meta.get("contact_id"),
        "external_ref": meta.get("external_ref") or meta.get("call_attempt_id") or str(meta.get("call_attempt_id", "")),
        "user_contact_masked": mask_phone(p.get("user_phone_number") or meta.get("user_phone_number")),
        "connectivity_status": conn,
        "completion_status": comp,
        "next_action_status": p.get("next_action_status"),
        "call_outcome": vars_.get("call_outcome"),
        "failure_reason": p.get("failure_reason"),
        "duration": float(p.get("duration")) if p.get("duration") is not None else None,
        "retry_attempt": int(p.get("retry_attempt")) if p.get("retry_attempt") is not None else 0,
        "executed_at": p.get("executed_at") or now_iso(),
        "agent_variables": json.dumps(vars_) if vars_ else None,
        "is_debug_call": 1 if p.get("is_debug_call") else 0,
        "source": "webhook",
    }
    return rec


def normalize_analytics_row(row: dict, agent_id: str) -> dict:
    g = lambda *ks: next((row[k] for k in ks if row.get(k) is not None), None)
    vars_ = g("agent_variables") or {}
    if isinstance(vars_, str):
        try:
            vars_ = json.loads(vars_)
        except ValueError:
            vars_ = {}
    conn = g("connectivity_status", "status")
    camp = g("campaign_id", "campaign")
    return {
        "attempt_id": str(g("attempt_id", "id")),
        "call_type": "campaign" if camp else "single",
        "campaign_id": str(camp) if camp else None,
        "cohort_id": g("cohort_id"),
        "agent_id": agent_id,
        "interaction_id": g("interaction_id"),
        "user_identifier": g("user_identifier"),
        "external_ref": (g("metadata") or {}).get("external_ref"),
        "user_contact_masked": mask_phone(g("user_contact_masked", "user_phone_number")),
        "connectivity_status": conn,
        "completion_status": g("completion_status"),
        "next_action_status": g("next_action_status"),
        "call_outcome": vars_.get("call_outcome"),
        "failure_reason": g("failure_reason"),
        "duration": float(g("duration", "duration_seconds") or 0.0) if g("duration", "duration_seconds") is not None else None,
        "retry_attempt": g("retry_attempt"),
        "executed_at": g("executed_at", "start_time", "created_at") or now_iso(),
        "agent_variables": json.dumps(vars_) if vars_ else None,
        "is_debug_call": 1 if g("is_debug_call") else 0,
        "source": "sync",
    }


# ------------------------------- UPSERT -------------------------------
COLS = [
    "call_type", "campaign_id", "cohort_id", "agent_id", "interaction_id", "user_identifier",
    "external_ref", "user_contact_masked", "connectivity_status", "completion_status",
    "next_action_status", "disposition", "followup_reason", "call_outcome", "failure_reason",
    "duration", "retry_attempt", "executed_at", "agent_variables", "is_debug_call"
]


def upsert_call(conn: sqlite3.Connection, rec: dict) -> bool:
    """
    Insert or merge one attempt. Non-null incoming values win; nulls never erase data.
    Returns True if the row was newly inserted.
    """
    if not rec.get("attempt_id"):
        return False
    existed = conn.execute("SELECT 1 FROM calls WHERE attempt_id=?", (rec["attempt_id"],)).fetchone()

    # Merge with stored values so disposition is derived from the complete picture
    stored = conn.execute("SELECT * FROM calls WHERE attempt_id=?", (rec["attempt_id"],)).fetchone()
    merged = {**(dict(stored) if stored else {}), **{k: v for k, v in rec.items() if v is not None}}
    rec["disposition"], rec["followup_reason"] = derive_disposition(merged)
    if rec["disposition"] in ("unknown", "not_connected") and stored:
        rec["disposition"] = stored["disposition"]
        rec["followup_reason"] = stored["followup_reason"]

    params = {c: rec.get(c) for c in COLS}
    params.update(
        attempt_id=rec["attempt_id"],
        source=rec["source"],
        now=now_iso(),
        tx_status="pending" if rec.get("interaction_id") else "not_applicable",
    )
    sets = ",".join(f"{c}=COALESCE(excluded.{c}, calls.{c})" for c in COLS)
    conn.execute(
        f"""
      INSERT INTO calls (attempt_id, {','.join(COLS)}, source, transcript_status, created_at, updated_at)
      VALUES (:attempt_id, {','.join(':'+c if c != 'is_debug_call' else 'COALESCE(:is_debug_call,0)' for c in COLS)},
              :source, :tx_status, :now, :now)
      ON CONFLICT(attempt_id) DO UPDATE SET {sets},
        transcript_status = CASE WHEN calls.transcript_status='not_applicable'
                                  AND excluded.interaction_id IS NOT NULL
                                 THEN 'pending' ELSE calls.transcript_status END,
        updated_at = excluded.updated_at
    """,
        params,
    )
    return not existed


def ingest_webhook(payload: dict) -> None:
    """Call this first thing in both webhook handlers (instant and campaign)."""
    if not payload or not isinstance(payload, dict):
        return
    with db() as c:
        upsert_call(c, normalize_webhook(payload))


def register_campaign(
    campaign_id: str,
    name: str,
    agent_id: str | None = None,
    start_iso: str | None = None,
    end_iso: str | None = None,
) -> None:
    with db() as c:
        c.execute(
            """INSERT INTO campaigns (campaign_id, name, agent_id, start_timestamp, end_timestamp, created_at)
               VALUES (?, ?, ?, ?, ?, ?)
               ON CONFLICT(campaign_id) DO UPDATE SET
                 name=excluded.name,
                 agent_id=COALESCE(excluded.agent_id, campaigns.agent_id),
                 start_timestamp=COALESCE(excluded.start_timestamp, campaigns.start_timestamp),
                 end_timestamp=COALESCE(excluded.end_timestamp, campaigns.end_timestamp)""",
            (str(campaign_id), name, agent_id or DEFAULT_AGENT_ID, start_iso, end_iso, now_iso()),
        )


# ------------------------------ TRANSCRIPTS ---------------------------
def render_transcript(raw: Any) -> str:
    """Turn Sarvam's transcript JSON into readable text. Returns '' if the shape is unknown."""
    if not raw:
        return ""
    turns = raw
    if isinstance(raw, dict):
        turns = next(
            (raw[k] for k in ("transcript", "turns", "messages", "conversation", "data") if raw.get(k) is not None),
            [],
        )
    if isinstance(turns, str):
        return turns.strip()

    names = {
        "user": "Customer",
        "customer": "Customer",
        "human": "Customer",
        "assistant": "Agent",
        "agent": "Agent",
        "bot": "Agent",
    }
    lines = []
    for t in turns if isinstance(turns, list) else []:
        if not isinstance(t, dict):
            continue
        role = str(t.get("role") or t.get("speaker") or "unknown").lower()
        text = t.get("text") or t.get("content") or t.get("en_text") or t.get("message") or ""
        if text:
            lines.append(f"{names.get(role, role.title())}: {str(text).strip()}")
    return "\n".join(lines)


async def fetch_transcript_raw(agent_id: str, interaction_id: str) -> Optional[dict]:
    """Returns parsed JSON, or None if not ready yet (404). Raises on other errors."""
    if not API_KEY or not ORG_ID or not WORKSPACE_ID:
        return None
    encoded_id = quote(interaction_id, safe="")
    url = f"{ANALYTICS_BASE}/{ORG_ID}/{WORKSPACE_ID}/{agent_id}/transcripts/{encoded_id}"
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.get(url, headers=HEADERS)
    if r.status_code == 404:
        return None
    r.raise_for_status()
    return r.json()


async def pull_transcript(attempt_id: str) -> str:
    """Fetch + store one transcript, with retry bookkeeping. Returns status."""
    with db() as c:
        row = c.execute("SELECT * FROM calls WHERE attempt_id=?", (attempt_id,)).fetchone()
    if not row or not row["interaction_id"] or not row["agent_id"]:
        return "not_applicable"

    raw, error = None, None
    try:
        raw = await fetch_transcript_raw(row["agent_id"], row["interaction_id"])
    except Exception as e:
        error = str(e)

    with db() as c:
        if raw is not None:
            text = render_transcript(raw)
            status = "ready" if text else "unparsed"
            c.execute(
                """INSERT INTO transcripts (interaction_id, attempt_id, raw_json, text, fetched_at)
                   VALUES (?, ?, ?, ?, ?)
                   ON CONFLICT(interaction_id) DO UPDATE SET
                     raw_json=excluded.raw_json,
                     text=excluded.text,
                     fetched_at=excluded.fetched_at""",
                (row["interaction_id"], attempt_id, json.dumps(raw), text, now_iso()),
            )
            c.execute(
                "UPDATE calls SET transcript_status=?, updated_at=? WHERE attempt_id=?",
                (status, now_iso(), attempt_id),
            )
            return status

        n = row["transcript_attempts"] + 1
        if n > len(TRANSCRIPT_RETRY_DELAYS):
            c.execute(
                "UPDATE calls SET transcript_status='unavailable', transcript_attempts=? WHERE attempt_id=?",
                (n, attempt_id),
            )
            log.warning("transcript unavailable for %s (%s)", attempt_id, error)
            return "unavailable"

        nxt = datetime.now(timezone.utc) + timedelta(seconds=TRANSCRIPT_RETRY_DELAYS[n - 1])
        c.execute(
            "UPDATE calls SET transcript_attempts=?, transcript_next_try_at=? WHERE attempt_id=?",
            (n, nxt.isoformat(), attempt_id),
        )
        return "pending"


async def process_pending_transcripts(batch: int = 50) -> int:
    with db() as c:
        ids = [
            r["attempt_id"]
            for r in c.execute(
                """SELECT attempt_id FROM calls WHERE transcript_status='pending'
                   AND (transcript_next_try_at IS NULL OR transcript_next_try_at <= ?)
                   ORDER BY executed_at LIMIT ?""",
                (now_iso(), batch),
            )
        ]
    for a in ids:
        await pull_transcript(a)
    return len(ids)


def transcript_for_followup(campaign_id: str, user_identifier: str, max_chars: int = 1500) -> str:
    """Latest non-empty transcript for this user: feed it into the follow-up cohort variable."""
    with db() as c:
        r = c.execute(
            """SELECT t.text FROM calls k JOIN transcripts t USING (interaction_id)
               WHERE k.campaign_id=? AND k.user_identifier=? AND t.text <> ''
               ORDER BY k.executed_at DESC LIMIT 1""",
            (str(campaign_id), str(user_identifier)),
        ).fetchone()
    return (r["text"] if r else "")[-max_chars:]


def transcript_settled(attempt_id: str) -> bool:
    """Follow-up dispatch should wait until this is True (ready / unparsed / unavailable / n.a.)."""
    with db() as c:
        r = c.execute("SELECT transcript_status s FROM calls WHERE attempt_id=?", (attempt_id,)).fetchone()
    return bool(r) and r["s"] != "pending"


# --------------------------- RECONCILIATION SYNC ----------------------
def _rows(body: Any) -> list:
    if isinstance(body, list):
        return body
    for k in ("data", "items", "results", "attempts"):
        if isinstance(body.get(k), list):
            return body[k]
    return []


async def sync_attempts(agent_id: str, start: datetime, end: datetime) -> dict:
    """Pull attempts for a window, upsert them, and report webhooks we never received."""
    if not API_KEY or not ORG_ID or not WORKSPACE_ID:
        return {"seen": 0, "missing_webhooks": 0, "note": "No API credentials"}
    url = f"{ANALYTICS_BASE}/{ORG_ID}/{WORKSPACE_ID}/{agent_id}/attempts"
    params: Any = {
        "start_datetime": start.isoformat(),
        "end_datetime": end.isoformat(),
        "limit": PAGE_LIMIT,
        "offset": 0,
    }
    seen = inserted = 0
    async with httpx.AsyncClient(timeout=60) as c:
        while url:
            r = await c.get(url, params=params, headers=HEADERS)
            if r.status_code == 404:
                break
            r.raise_for_status()
            body = r.json()
            with db() as conn:
                for row in _rows(body):
                    seen += 1
                    inserted += 1 if upsert_call(conn, normalize_analytics_row(row, agent_id)) else 0
            nxt = body.get("next_page_uri") if isinstance(body, dict) else None
            url = None if not nxt else (nxt if nxt.startswith("http") else ANALYTICS_HOST + nxt)
            params = None
    return {"seen": seen, "missing_webhooks": inserted}


async def run_incremental_sync(agent_id: str) -> dict:
    key = f"attempts:{agent_id}"
    with db() as c:
        r = c.execute("SELECT value FROM sync_state WHERE key=?", (key,)).fetchone()
    end = datetime.now(timezone.utc) - timedelta(minutes=1)
    start = (datetime.fromisoformat(r["value"]) - SYNC_OVERLAP) if r else end - SYNC_FIRST_LOOKBACK
    result = await sync_attempts(agent_id, start, end)
    with db() as c:
        c.execute(
            "INSERT INTO sync_state VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (key, end.isoformat()),
        )
    return result


def start_workers(agent_ids: Optional[List[str]] = None) -> None:
    ids = agent_ids or [DEFAULT_AGENT_ID]

    async def transcripts_loop():
        while True:
            try:
                await process_pending_transcripts()
            except Exception:
                log.exception("transcript worker error")
            await asyncio.sleep(TRANSCRIPT_INTERVAL_SEC)

    async def sync_loop():
        while True:
            for a in ids:
                try:
                    await run_incremental_sync(a)
                except Exception:
                    log.exception("sync worker error")
            await asyncio.sleep(SYNC_INTERVAL_SEC)

    asyncio.create_task(transcripts_loop())
    asyncio.create_task(sync_loop())


# ------------------------------ SEED SYNC -----------------------------
def seed_from_django_if_empty():
    """Seeds existing campaigns & call attempts from Django SQLite database into history.db."""
    try:
        django_db_path = BASE_DIR / "db.sqlite3"
        if not django_db_path.exists():
            return
        d_conn = sqlite3.connect(django_db_path)
        d_conn.row_factory = sqlite3.Row

        with db() as c:
            # 1. Seed Campaigns
            c_rows = d_conn.execute("SELECT * FROM campaigns_campaign").fetchall()
            for row_obj in c_rows:
                row = dict(row_obj)
                c.execute(
                    """INSERT INTO campaigns (campaign_id, name, agent_id, start_timestamp, end_timestamp, created_at)
                       VALUES (?, ?, ?, ?, ?, ?)
                       ON CONFLICT(campaign_id) DO UPDATE SET name=excluded.name""",
                    (
                        str(row["id"]),
                        row["name"],
                        str(row["agent_id"]),
                        row.get("scheduled_start_time") or row.get("started_at"),
                        row.get("completed_at"),
                        row.get("created_at") or now_iso(),
                    ),
                )

            # 2. Seed Call Attempts
            a_rows = d_conn.execute("SELECT * FROM calls_callattempt").fetchall()
            for row_obj in a_rows:
                row = dict(row_obj)
                attempt_id = row["sarvam_attempt_id"] or f"att_local_{row['id']}"
                call_type = "campaign" if row["campaign_id"] else "single"
                status = row["status"]
                disposition = "success" if status == "connected" else ("not_connected" if status in ("no_answer", "busy") else "followup")

                c.execute(
                    """INSERT INTO calls (
                         attempt_id, call_type, campaign_id, agent_id, interaction_id,
                         user_identifier, external_ref, user_contact_masked,
                         connectivity_status, completion_status, disposition, duration,
                         failure_reason, executed_at, source, transcript_status, created_at, updated_at
                       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                       ON CONFLICT(attempt_id) DO NOTHING""",
                    (
                        attempt_id,
                        call_type,
                        str(row["campaign_id"]) if row["campaign_id"] else None,
                        str(row["agent_id"]),
                        row.get("interaction_id"),
                        str(row.get("contact_id") or ""),
                        str(row["id"]),
                        mask_phone(row.get("user_phone_number")),
                        status,
                        "completed" if status == "connected" else status,
                        disposition,
                        float(row.get("duration_seconds") or 0.0),
                        row.get("failure_reason"),
                        row.get("created_at") or now_iso(),
                        "sync",
                        "ready" if row.get("interaction_id") else "not_applicable",
                        row.get("created_at") or now_iso(),
                        row.get("created_at") or now_iso(),
                    ),
                )

                # 3. Seed transcripts if present
                if row.get("interaction_id"):
                    t_row_obj = d_conn.execute(
                        "SELECT * FROM calls_transcript WHERE call_attempt_id=?", (row["id"],)
                    ).fetchone()
                    if t_row_obj:
                        t_row = dict(t_row_obj)
                        if t_row.get("messages"):
                            try:
                                msg_data = json.loads(t_row["messages"])
                                txt = render_transcript(msg_data)
                                c.execute(
                                    """INSERT INTO transcripts (interaction_id, attempt_id, raw_json, text, fetched_at)
                                       VALUES (?, ?, ?, ?, ?)
                                       ON CONFLICT(interaction_id) DO NOTHING""",
                                    (row["interaction_id"], attempt_id, t_row["messages"], txt, now_iso()),
                                )
                            except Exception:
                                pass
        d_conn.close()
    except Exception as exc:
        log.warning("Could not auto-seed history from Django: %s", exc)


# ------------------------------ HISTORY API ---------------------------
router = APIRouter(prefix="/history")
LIST_COLS = (
    "attempt_id, call_type, campaign_id, user_identifier, external_ref, user_contact_masked, "
    "connectivity_status, completion_status, disposition, followup_reason, call_outcome, duration, "
    "retry_attempt, executed_at, transcript_status, source"
)


def _page(where: str, args: list, limit: Any, offset: Any) -> dict:
    l_val = int(getattr(limit, "default", limit) if hasattr(limit, "default") else (limit or 50))
    o_val = int(getattr(offset, "default", offset) if hasattr(offset, "default") else (offset or 0))
    with db() as c:
        total = c.execute(f"SELECT COUNT(*) n FROM calls WHERE {where}", args).fetchone()["n"]
        items = [
            dict(r)
            for r in c.execute(
                f"SELECT {LIST_COLS} FROM calls WHERE {where} ORDER BY executed_at DESC LIMIT ? OFFSET ?",
                args + [l_val, o_val],
            )
        ]
    return {"total": total, "limit": l_val, "offset": o_val, "items": items}


@router.get("/campaigns")
def list_campaign_history():
    """
    The 'Campaigns' section of History: one row per campaign with summary counters.
    Clicking a campaign lets the UI display all calls for that specific campaign.
    """
    with db() as c:
        rows = c.execute(
            """
          SELECT c.campaign_id, c.name, c.agent_id, c.start_timestamp, c.end_timestamp,
                 COUNT(k.attempt_id) AS total_attempts,
                 COUNT(DISTINCT k.user_identifier) AS unique_users,
                 COALESCE(SUM(k.connectivity_status='connected'), 0) AS connected,
                 COALESCE(SUM(k.disposition='success'), 0) AS successful,
                 COALESCE(SUM(k.disposition='followup'), 0) AS followups,
                 MAX(k.executed_at) AS last_call_at
          FROM campaigns c
          LEFT JOIN calls k ON k.campaign_id=c.campaign_id AND k.is_debug_call=0
          GROUP BY c.campaign_id
          ORDER BY COALESCE(MAX(k.executed_at), c.created_at) DESC
        """
        ).fetchall()
    return [dict(r) for r in rows]


@router.get("/campaigns/{campaign_id}/calls")
def campaign_calls(
    campaign_id: str,
    disposition: Optional[str] = None,
    reason: Optional[str] = None,
    user_identifier: Optional[str] = None,
    include_debug: bool = False,
    limit: int = Query(50, le=500),
    offset: int = 0,
):
    where, args = ["campaign_id=?"], [str(campaign_id)]
    if not include_debug:
        where.append("is_debug_call=0")
    if disposition:
        where.append("disposition=?")
        args.append(disposition)
    if reason:
        where.append("followup_reason=?")
        args.append(reason)
    if user_identifier:
        where.append("user_identifier=?")
        args.append(user_identifier)
    return _page(" AND ".join(where), args, limit, offset)


@router.get("/campaigns/{campaign_id}/users/{user_identifier}")
def user_attempts_in_campaign(campaign_id: str, user_identifier: str):
    """Every attempt for one user in that campaign."""
    return _page("campaign_id=? AND user_identifier=?", [str(campaign_id), str(user_identifier)], 500, 0)


@router.get("/single-calls")
def single_call_history(
    disposition: Optional[str] = None,
    include_debug: bool = False,
    limit: int = Query(50, le=500),
    offset: int = 0,
):
    """Single (instant) calls only, kept completely separate from batch campaigns."""
    where, args = ["call_type='single'"], []
    if not include_debug:
        where.append("is_debug_call=0")
    if disposition:
        where.append("disposition=?")
        args.append(disposition)
    return _page(" AND ".join(where), args, limit, offset)


@router.get("/calls/{attempt_id}")
def call_detail(attempt_id: str):
    """One call with its stored transcript and variables."""
    with db() as c:
        row = c.execute(
            """SELECT k.*, t.text AS transcript_text, t.raw_json AS transcript_raw
               FROM calls k
               LEFT JOIN transcripts t USING (interaction_id)
               WHERE k.attempt_id=?""",
            (attempt_id,),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Call attempt not found")
    d = dict(row)
    if d.get("agent_variables"):
        try:
            d["agent_variables"] = json.loads(d["agent_variables"])
        except Exception:
            pass
    return d


@router.get("/calls/{attempt_id}/transcript")
async def call_transcript(attempt_id: str):
    """Transcript text (fetched on demand from Analytics API if missing)."""
    with db() as c:
        row = c.execute(
            "SELECT transcript_status s, interaction_id i FROM calls WHERE attempt_id=?",
            (attempt_id,),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Call attempt not found")
    status = row["s"]
    if status == "pending":
        status = await pull_transcript(attempt_id)
    with db() as c:
        t = c.execute("SELECT text, raw_json FROM transcripts WHERE interaction_id=?", (row["i"],)).fetchone()
    return {
        "status": status,
        "text": t["text"] if t else None,
        "has_raw": bool(t and t["raw_json"]),
    }


# Standalone FastAPI Application for sarvam_history
app = FastAPI(
    title="Sarvam Call History & Transcript Pipeline",
    description="Unified, separated history storage and automated transcript extraction for single calls and batch campaigns.",
    version="1.0.0",
)
app.include_router(router)


@app.on_event("startup")
async def _startup():
    init_db()
    start_workers(agent_ids=[DEFAULT_AGENT_ID])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("sarvam_history:app", host="0.0.0.0", port=8003, reload=True)
