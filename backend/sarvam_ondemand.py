"""
On-demand full call history from Sarvam's Analytics API (attempts, interactions, transcripts,
recordings) layered on top of sarvam_history.py.

  Live (always fresh, nothing required in your DB)
    GET  /history/live/attempts       GET /history/live/interactions     (filters, paging, PII scrubbed)
  One call, everything joined (attempt + interaction + transcript + recording link)
    GET  /history/calls/{attempt_id}/full
  Transcript / recording by interaction_id (ids look like 20261007/9f1c...; slash is fine)
    GET  /history/interactions/{interaction_id}/transcript
    GET  /history/interactions/{interaction_id}/recording             (streams WAV, supports Range)
  Bulk
    POST /history/backfill            GET /history/backfill/{job_id}
  QA
    GET  /history/qa/sample           (short calls, failures, follow-ups)

Wire-up (after sarvam_history's):
    from sarvam_ondemand import router as ondemand_router, init_ondemand_db
    init_ondemand_db(); app.include_router(ondemand_router)

SECURITY: these endpoints expose transcripts and recordings (personal data). Put them behind
your own auth and role checks. Interaction items from Sarvam contain the FULL phone number
(user_contact); this module masks it before anything is returned or stored.
"""
import asyncio
import json
import logging
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import AsyncIterator, Optional
from urllib.parse import quote

import httpx
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

try:
    from backend.sarvam_history import (
        ANALYTICS_BASE,
        ANALYTICS_HOST,
        ORG_ID,
        WORKSPACE_ID,
        HEADERS,
        db,
        now_iso,
        mask_phone,
        render_transcript,
        sync_attempts,
    )
except ImportError:
    from sarvam_history import (
        ANALYTICS_BASE,
        ANALYTICS_HOST,
        ORG_ID,
        WORKSPACE_ID,
        HEADERS,
        db,
        now_iso,
        mask_phone,
        render_transcript,
        sync_attempts,
    )

log = logging.getLogger("ondemand")

# ------------------------------ CONFIG --------------------------------
DEFAULT_AGENT_ID = os.getenv("SARVAM_DEFAULT_APP_ID", "agent_sales_v1").strip()
RECORDINGS_DIR = Path(__file__).resolve().parent / "recordings"
MAX_LIVE_WINDOW = timedelta(days=31)
BACKFILL_CHUNK = timedelta(days=1)
RECORDING_CONCURRENCY = 3
RETRY_STATUSES = {429, 500, 502, 503, 504}
MAX_RETRIES = 4
PII_KEYS = {"user_contact"}

# Filterable field names: confirm against the "Filtering" table in the Analytics overview page.
FIELD_INTERACTION_ID = "interaction_id"
FIELD_CAMPAIGN = "campaign_id"
FIELD_STATUS = "status"
FIELD_DURATION = "duration"
STRING_OPS = {"equals", "not_equals", "includes", "starts_with", "ends_with", "is_empty", "is_not_empty"}
NUMBER_OPS = {"equals", "not_equals", "greater_than", "less_than"}
ALL_OPS = STRING_OPS | NUMBER_OPS
INTERACTION_ID_RE = re.compile(r"^\d{8}/[\w\-]+$")  # blocks path traversal on disk

EXTRA_SCHEMA = """
CREATE TABLE IF NOT EXISTS interactions (
  interaction_id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, attempt_id TEXT,
  duration REAL, language TEXT, end_reason TEXT, started_at TEXT,
  agent_variables TEXT, user_contact_masked TEXT,
  translate_text TEXT,                       -- English translation of the transcript, if provided
  recording_status TEXT NOT NULL DEFAULT 'unknown',   -- unknown | available | downloaded | none
  recording_path TEXT,
  raw_json TEXT,                             -- item as returned, minus PII and transcripts
  synced_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_inter_agent ON interactions(agent_id, started_at);
"""


def init_ondemand_db() -> None:
    with db() as c:
        c.executescript(EXTRA_SCHEMA)


# --------------------------- ANALYTICS CLIENT -------------------------
def _base(agent_id: str) -> str:
    return f"{ANALYTICS_BASE}/{ORG_ID}/{WORKSPACE_ID}/{agent_id}"


def enc_id(interaction_id: str) -> str:
    if not INTERACTION_ID_RE.match(interaction_id):
        raise HTTPException(400, "interaction_id must look like YYYYMMDD/<id>")
    return quote(interaction_id, safe="")


def build_filters(*conds: tuple) -> str | None:
    """build_filters(("duration","less_than",25), ("status","equals","connected")) -> JSON string."""
    out = []
    for i, (field, op, *val) in enumerate(conds, 1):
        if op not in ALL_OPS:
            raise ValueError(f"unsupported operator {op}")
        item = {"id": str(i), "field": field, "operator": op}
        if val and val[0] is not None:
            item["value"] = val[0]
        out.append(item)
    return json.dumps(out) if out else None


def validate_filters(raw: str | None) -> str | None:
    """Accept a client-supplied filter_conditions string; reject anything malformed."""
    if not raw:
        return None
    try:
        data = json.loads(raw)
        assert isinstance(data, list) and len(data) <= 20
        for f in data:
            assert {"field", "operator"} <= set(f) and f["operator"] in ALL_OPS
    except (ValueError, AssertionError):
        raise HTTPException(422, "filters must be a JSON list of {id, field, operator, value}")
    return raw


async def _get_json(url: str, params: dict | None = None) -> dict | list:
    """GET with retry on 429/5xx (honours Retry-After)."""
    for attempt in range(MAX_RETRIES + 1):
        try:
            async with httpx.AsyncClient(timeout=60) as c:
                r = await c.get(url, params=params, headers=HEADERS)
            if r.status_code in RETRY_STATUSES and attempt < MAX_RETRIES:
                wait = float(r.headers.get("Retry-After", 0)) or 2 ** attempt
                log.warning("analytics %s -> %s, retrying in %.0fs", url, r.status_code, wait)
                await asyncio.sleep(wait)
                continue
            if r.status_code == 404:
                raise HTTPException(404, "not found in Sarvam analytics")
            if r.status_code in (401, 403):
                raise HTTPException(502, "Sarvam rejected the API key / scope")
            r.raise_for_status()
            return r.json()
        except httpx.HTTPError as exc:
            if attempt == MAX_RETRIES:
                log.warning("Sarvam analytics request failed: %s", exc)
                return []
            await asyncio.sleep(1)
    raise HTTPException(503, "analytics unavailable")


def _rows(body) -> list:
    if isinstance(body, list):
        return body
    for k in ("data", "items", "results", "interactions", "attempts"):
        if isinstance(body.get(k), list):
            return body[k]
    return []


def scrub(item: dict) -> dict:
    """Never pass the full phone number onward."""
    out = {k: v for k, v in item.items() if k not in PII_KEYS}
    if isinstance(item.get("user_contact"), str):
        out["user_contact_masked"] = mask_phone(item["user_contact"])
    return out


async def list_page(
    agent_id: str,
    kind: str,
    start: datetime,
    end: datetime,
    *,
    filters: str | None = None,
    limit: int = 20,
    offset: int = 0,
    include_transcript: bool = False,
) -> dict:
    """One page of 'attempts' or 'interactions' (the same shape Sarvam returns, PII scrubbed)."""
    params = {
        "start_datetime": start.isoformat(),
        "end_datetime": end.isoformat(),
        "limit": limit,
        "offset": offset,
    }
    if filters:
        params["filter_conditions"] = filters
    if include_transcript and kind == "interactions":
        params["include_transcript"] = "true"

    try:
        body = await _get_json(f"{_base(agent_id)}/{kind}", params)
    except HTTPException:
        body = {"total": 0, "limit": limit, "offset": offset, "items": [], kind: []}

    if isinstance(body, dict):
        key = next((k for k in ("data", "items", "results", kind) if isinstance(body.get(k), list)), None)
        if key:
            scrubbed = [scrub(r) for r in body[key]]
            body[key] = scrubbed
            if "items" not in body:
                body["items"] = scrubbed
        else:
            if "items" not in body:
                body["items"] = []
        return body
    elif isinstance(body, list):
        scrubbed = [scrub(r) for r in body]
        return {"total": len(body), "limit": limit, "offset": offset, "items": scrubbed, kind: scrubbed}
    return {"total": 0, "limit": limit, "offset": offset, "items": [], kind: []}


async def iter_pages(
    agent_id: str,
    kind: str,
    start: datetime,
    end: datetime,
    *,
    filters: str | None = None,
    include_transcript: bool = False,
) -> AsyncIterator[list]:
    """Follow next_page_uri until null; yields raw rows (still containing PII, scrub before exposing)."""
    url = f"{_base(agent_id)}/{kind}"
    params = {"start_datetime": start.isoformat(), "end_datetime": end.isoformat(), "limit": 1000, "offset": 0}
    if filters:
        params["filter_conditions"] = filters
    if include_transcript and kind == "interactions":
        params["include_transcript"] = "true"
    while url:
        body = await _get_json(url, params)
        yield _rows(body)
        nxt = body.get("next_page_uri") if isinstance(body, dict) else None
        url = None if not nxt else (nxt if nxt.startswith("http") else ANALYTICS_HOST + nxt)
        params = None


# --------------------------- INTERACTION STORE ------------------------
def normalize_interaction(item: dict, agent_id: str) -> dict:
    g = lambda *ks: next((item[k] for k in ks if item.get(k) is not None), None)
    vars_ = g("agent_variables", "final_agent_variables") or {}
    contact = item.get("user_contact")
    clean = {
        k: v
        for k, v in item.items()
        if k not in PII_KEYS | {"original_transcript", "translate_transcript", "audio_url"}
    }
    return {
        "interaction_id": g("interaction_id"),
        "agent_id": agent_id,
        "attempt_id": g("attempt_id"),
        "duration": g("duration", "duration_seconds"),
        "language": g("language", "language_name"),
        "end_reason": g("end_reason", "call_end_reason", "ended_by"),
        "started_at": g("started_at", "start_time", "created_at"),
        "agent_variables": json.dumps(vars_) if vars_ else None,
        "user_contact_masked": mask_phone(contact) if isinstance(contact, str) else None,
        "translate_text": render_transcript(item.get("translate_transcript")) or None,
        "recording_status": "available" if g("audio_url") else "unknown",  # signed URL itself is not stored
        "raw_json": json.dumps(clean),
        "_original": item.get("original_transcript"),
    }


def upsert_interaction(conn, rec: dict) -> bool:
    if not rec.get("interaction_id"):
        return False
    existed = conn.execute("SELECT 1 FROM interactions WHERE interaction_id=?", (rec["interaction_id"],)).fetchone()
    cols = [
        "agent_id",
        "attempt_id",
        "duration",
        "language",
        "end_reason",
        "started_at",
        "agent_variables",
        "user_contact_masked",
        "translate_text",
        "raw_json",
    ]
    p = {c: rec.get(c) for c in cols}
    p.update(interaction_id=rec["interaction_id"], rs=rec["recording_status"], now=now_iso())
    sets = ",".join(f"{c}=COALESCE(excluded.{c}, interactions.{c})" for c in cols)
    conn.execute(
        f"""
      INSERT INTO interactions (interaction_id, {','.join(cols)}, recording_status, synced_at)
      VALUES (:interaction_id, {','.join(':'+c for c in cols)}, :rs, :now)
      ON CONFLICT(interaction_id) DO UPDATE SET {sets},
        recording_status = CASE WHEN interactions.recording_status IN ('downloaded','none')
                                THEN interactions.recording_status ELSE excluded.recording_status END,
        synced_at = excluded.synced_at""",
        p,
    )

    # Transcript arrives inline when include_transcript=true: store it and settle the call row.
    text = render_transcript(rec.get("_original")) if rec.get("_original") else ""
    if text:
        conn.execute(
            """INSERT INTO transcripts (interaction_id, attempt_id, raw_json, text, fetched_at)
               VALUES (?,?,?,?,?) ON CONFLICT(interaction_id) DO UPDATE SET
               raw_json=excluded.raw_json, text=excluded.text, fetched_at=excluded.fetched_at""",
            (rec["interaction_id"], rec.get("attempt_id"), json.dumps(rec["_original"]), text, now_iso()),
        )
        conn.execute("UPDATE calls SET transcript_status='ready' WHERE interaction_id=?", (rec["interaction_id"],))
    return not existed


async def sync_interactions(
    agent_id: str,
    start: datetime,
    end: datetime,
    *,
    include_transcript: bool = True,
    filters: str | None = None,
) -> dict:
    seen = new = 0
    async for rows in iter_pages(
        agent_id, "interactions", start, end, filters=filters, include_transcript=include_transcript
    ):
        with db() as conn:
            for row in rows:
                seen += 1
                new += upsert_interaction(conn, normalize_interaction(row, agent_id))
    return {"interactions_seen": seen, "interactions_new": new}


# ------------------------------ RECORDINGS ----------------------------
def recording_path(interaction_id: str) -> Path:
    enc_id(interaction_id)  # validates format
    day, ident = interaction_id.split("/")
    return RECORDINGS_DIR / day / f"{ident}.wav"


def _agent_for_interaction(interaction_id: str, agent_id: str | None) -> str:
    if agent_id:
        return agent_id
    with db() as c:
        r = c.execute(
            "SELECT agent_id FROM interactions WHERE interaction_id=? "
            "UNION SELECT agent_id FROM calls WHERE interaction_id=? LIMIT 1",
            (interaction_id, interaction_id),
        ).fetchone()
    return r["agent_id"] if r and r["agent_id"] else DEFAULT_AGENT_ID


def _set_recording(interaction_id: str, status: str, path: str | None = None) -> None:
    with db() as c:
        c.execute(
            "UPDATE interactions SET recording_status=?, recording_path=COALESCE(?, recording_path) "
            "WHERE interaction_id=?",
            (status, path, interaction_id),
        )


async def download_recording(agent_id: str, interaction_id: str) -> str | None:
    """Archive one recording to disk (for QA). Returns the path, or None if no recording exists."""
    dest = recording_path(interaction_id)
    if dest.exists():
        return str(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(".part")
    url = f"{_base(agent_id)}/recordings/{enc_id(interaction_id)}"
    for attempt in range(MAX_RETRIES + 1):
        try:
            async with httpx.AsyncClient(timeout=120) as c:
                async with c.stream("GET", url, headers=HEADERS) as r:
                    if r.status_code == 404:
                        _set_recording(interaction_id, "none")
                        return None
                    if r.status_code in RETRY_STATUSES and attempt < MAX_RETRIES:
                        await asyncio.sleep(float(r.headers.get("Retry-After", 0)) or 2 ** attempt)
                        continue
                    r.raise_for_status()
                    with open(tmp, "wb") as f:
                        async for chunk in r.aiter_bytes():
                            f.write(chunk)
            tmp.replace(dest)  # atomic: no half-written .wav ever visible
            _set_recording(interaction_id, "downloaded", str(dest))
            return str(dest)
        except Exception as exc:
            if attempt == MAX_RETRIES:
                log.warning("Could not download recording: %s", exc)
                return None
            await asyncio.sleep(1)
    return None


async def download_pending_recordings(agent_id: str, limit: int = 200) -> dict:
    with db() as c:
        ids = [
            r["interaction_id"]
            for r in c.execute(
                "SELECT interaction_id FROM interactions WHERE agent_id=? AND recording_status IN ('available','unknown') "
                "LIMIT ?",
                (agent_id, limit),
            )
        ]
    sem, ok, none = asyncio.Semaphore(RECORDING_CONCURRENCY), 0, 0

    async def one(i):
        nonlocal ok, none
        async with sem:
            try:
                if await download_recording(agent_id, i):
                    ok += 1
                else:
                    none += 1
            except Exception:
                log.exception("recording %s", i)

    await asyncio.gather(*(one(i) for i in ids))
    return {"recordings_downloaded": ok, "no_recording": none, "checked": len(ids)}


# ------------------------------- BACKFILL -----------------------------
JOBS: dict[str, dict] = {}


def day_chunks(start: datetime, end: datetime):
    s = start
    while s < end:
        e = min(s + BACKFILL_CHUNK, end)
        yield s, e
        s = e


async def run_backfill(
    job_id: str,
    agent_id: str,
    start: datetime,
    end: datetime,
    with_transcripts: bool,
    with_recordings: bool,
) -> None:
    job = JOBS[job_id]
    try:
        for s, e in day_chunks(start, end):
            a = await sync_attempts(agent_id, s, e)
            i = await sync_interactions(agent_id, s, e, include_transcript=with_transcripts)
            for k, v in {**a, **i}.items():
                job["totals"][k] = job["totals"].get(k, 0) + v
            job["progress"] = e.isoformat()
        if with_recordings:
            job["totals"].update(await download_pending_recordings(agent_id))
        job["status"] = "done"
    except Exception as ex:
        log.exception("backfill failed")
        job.update(status="failed", error=str(ex))


# ------------------------------- ENDPOINTS ----------------------------
router = APIRouter(prefix="/history")


def _dt(s: str) -> datetime:
    try:
        d = datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(422, f"bad datetime: {s}")
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def _window(start: str, end: str) -> tuple[datetime, datetime]:
    s, e = _dt(start), _dt(end)
    if e <= s or e - s > MAX_LIVE_WINDOW:
        raise HTTPException(422, f"window must be >0 and <= {MAX_LIVE_WINDOW.days} days")
    return s, e


def _convenience_filters(raw, status, campaign_id, interaction_id, min_duration, max_duration):
    conds = []
    if status:
        conds.append((FIELD_STATUS, "equals", status))
    if campaign_id:
        conds.append((FIELD_CAMPAIGN, "equals", campaign_id))
    if interaction_id:
        conds.append((FIELD_INTERACTION_ID, "equals", interaction_id))
    if min_duration is not None:
        conds.append((FIELD_DURATION, "greater_than", min_duration))
    if max_duration is not None:
        conds.append((FIELD_DURATION, "less_than", max_duration))
    built = json.loads(build_filters(*conds)) if conds else []
    given = json.loads(validate_filters(raw)) if raw else []
    merged = [{**f, "id": str(i)} for i, f in enumerate(given + built, 1)]
    return json.dumps(merged) if merged else None


@router.get("/live/attempts")
async def live_attempts(
    start: str,
    end: str,
    agent_id: str = DEFAULT_AGENT_ID,
    filters: str | None = None,
    status: str | None = None,
    campaign_id: str | None = None,
    min_duration: float | None = None,
    max_duration: float | None = None,
    limit: int = Query(20, le=1000),
    offset: int = 0,
):
    s, e = _window(start, end)
    f = _convenience_filters(filters, status, campaign_id, None, min_duration, max_duration)
    return await list_page(agent_id, "attempts", s, e, filters=f, limit=limit, offset=offset)


@router.get("/live/interactions")
async def live_interactions(
    start: str,
    end: str,
    agent_id: str = DEFAULT_AGENT_ID,
    filters: str | None = None,
    campaign_id: str | None = None,
    min_duration: float | None = None,
    max_duration: float | None = None,
    include_transcript: bool = False,
    limit: int = Query(20, le=1000),
    offset: int = 0,
):
    s, e = _window(start, end)
    f = _convenience_filters(filters, None, campaign_id, None, min_duration, max_duration)
    return await list_page(
        agent_id, "interactions", s, e, filters=f, limit=limit, offset=offset, include_transcript=include_transcript
    )


async def _ensure_interaction(interaction_id: str, agent_id: str) -> None:
    """Make sure the interaction (and its transcript) is in our DB; fetch it live if not."""
    with db() as c:
        if c.execute("SELECT 1 FROM interactions WHERE interaction_id=?", (interaction_id,)).fetchone():
            return
    enc_id(interaction_id)
    day = datetime.strptime(interaction_id[:8], "%Y%m%d").replace(tzinfo=timezone.utc)
    f = build_filters((FIELD_INTERACTION_ID, "equals", interaction_id))
    try:
        await sync_interactions(agent_id, day - timedelta(days=1), day + timedelta(days=2), filters=f)
    except Exception as exc:
        log.warning("Could not sync interaction %s: %s", interaction_id, exc)


@router.get("/calls/{attempt_id}/full")
async def call_full(attempt_id: str, refresh: bool = False):
    with db() as c:
        call = c.execute("SELECT * FROM calls WHERE attempt_id=?", (attempt_id,)).fetchone()
    if not call:
        raise HTTPException(404, "call not found")
    call = dict(call)
    out = {"attempt": call, "interaction": None, "transcript": None, "translation": None, "recording": None}
    iid = call["interaction_id"]
    if not iid:
        return out
    agent = call["agent_id"] or DEFAULT_AGENT_ID
    if refresh:
        with db() as c:
            c.execute("DELETE FROM interactions WHERE interaction_id=?", (iid,))
    await _ensure_interaction(iid, agent)
    with db() as c:
        inter = c.execute("SELECT * FROM interactions WHERE interaction_id=?", (iid,)).fetchone()
        tr = c.execute("SELECT text FROM transcripts WHERE interaction_id=?", (iid,)).fetchone()
    if inter:
        inter = dict(inter)
        try:
            inter["agent_variables"] = json.loads(inter["agent_variables"]) if inter.get("agent_variables") else {}
        except Exception:
            pass
        try:
            inter["raw_json"] = json.loads(inter["raw_json"]) if inter.get("raw_json") else None
        except Exception:
            pass
        out["interaction"] = inter
        out["translation"] = inter.get("translate_text")
        if inter["recording_status"] != "none":
            out["recording"] = f"/api/v1/history/interactions/{iid}/recording/"
    out["transcript"] = tr["text"] if tr else None
    return out


@router.get("/interactions/{interaction_id:path}/transcript")
async def interaction_transcript(interaction_id: str, agent_id: str | None = None):
    # Normalize interaction_id if trailing slash exists
    interaction_id = interaction_id.strip("/")
    agent = _agent_for_interaction(interaction_id, agent_id)
    await _ensure_interaction(interaction_id, agent)
    with db() as c:
        tr = c.execute("SELECT text FROM transcripts WHERE interaction_id=?", (interaction_id,)).fetchone()
        it = c.execute("SELECT translate_text FROM interactions WHERE interaction_id=?", (interaction_id,)).fetchone()
    if not tr:
        try:
            body = await _get_json(f"{_base(agent)}/transcripts/{enc_id(interaction_id)}")
            text = render_transcript(body)
            return {"text": text or None, "raw": None if text else body, "translation": None}
        except Exception:
            return {"text": None, "raw": None, "translation": None}
    return {"text": tr["text"], "translation": it["translate_text"] if it else None}


@router.get("/interactions/{interaction_id:path}/recording")
async def interaction_recording(interaction_id: str, request: Request, agent_id: str | None = None):
    """Streams the WAV from Sarvam (nothing is stored). Range requests are forwarded so players can seek."""
    interaction_id = interaction_id.strip("/")
    agent = _agent_for_interaction(interaction_id, agent_id)
    url = f"{_base(agent)}/recordings/{enc_id(interaction_id)}"
    headers = dict(HEADERS)
    if request.headers.get("range"):
        headers["Range"] = request.headers["range"]
    client = httpx.AsyncClient(timeout=None)
    try:
        upstream = await client.send(client.build_request("GET", url, headers=headers), stream=True)
    except Exception as exc:
        await client.aclose()
        raise HTTPException(502, f"Failed to connect to audio service: {exc}")

    if upstream.status_code >= 400:
        code = upstream.status_code
        await upstream.aclose()
        await client.aclose()
        if code == 404:
            _set_recording(interaction_id, "none")
            raise HTTPException(404, "this interaction has no recording")
        raise HTTPException(502 if code >= 500 else code, "recording unavailable")

    keep = {
        k: v
        for k, v in upstream.headers.items()
        if k.lower() in ("content-length", "content-range", "accept-ranges", "content-disposition")
    }

    async def body():
        try:
            async for chunk in upstream.aiter_raw():
                yield chunk
        finally:
            await upstream.aclose()
            await client.aclose()

    return StreamingResponse(body(), status_code=upstream.status_code, media_type="audio/wav", headers=keep)


@router.post("/backfill")
async def start_backfill(body: dict):
    """{ "agent_id": "...", "start": ISO, "end": ISO, "with_transcripts": true, "with_recordings": false }"""
    agent = body.get("agent_id", DEFAULT_AGENT_ID)
    s, e = _dt(body["start"]), _dt(body["end"])
    if e <= s:
        raise HTTPException(422, "end must be after start")
    job_id = uuid.uuid4().hex
    JOBS[job_id] = {
        "status": "running",
        "agent_id": agent,
        "start": s.isoformat(),
        "end": e.isoformat(),
        "progress": None,
        "totals": {},
        "error": None,
    }
    asyncio.create_task(
        run_backfill(
            job_id,
            agent,
            s,
            e,
            body.get("with_transcripts", True),
            body.get("with_recordings", False),
        )
    )
    return {"job_id": job_id}


@router.get("/backfill/{job_id}")
def backfill_status(job_id: str):
    if job_id not in JOBS:
        raise HTTPException(404, "unknown job")
    return JOBS[job_id]


@router.get("/qa/sample")
def qa_sample(
    campaign_id: str | None = None,
    short_under_seconds: float = 25,
    n: int = Query(20, le=200),
    include: str = "short,failed,followup",
):
    """Random sample of the calls most worth a human listen: short connected calls, failures, follow-ups."""
    kinds, parts = set(include.split(",")), []
    if "short" in kinds:
        parts.append("(connectivity_status='connected' AND duration < :short)")
    if "failed" in kinds:
        parts.append("(completion_status='failed' OR failure_reason IS NOT NULL)")
    if "followup" in kinds:
        parts.append("disposition='followup'")
    if not parts:
        raise HTTPException(422, "include must contain short, failed and/or followup")
    where = "is_debug_call=0 AND (" + " OR ".join(parts) + ")"
    args: dict = {"short": short_under_seconds, "n": n}
    if campaign_id:
        where += " AND campaign_id=:cid"
        args["cid"] = campaign_id
    with db() as c:
        rows = c.execute(
            f"""SELECT attempt_id, campaign_id, user_identifier, connectivity_status, disposition,
                       followup_reason, failure_reason, duration, executed_at, interaction_id
                FROM calls WHERE {where} ORDER BY RANDOM() LIMIT :n""",
            args,
        ).fetchall()
    return [dict(r) | {"detail": f"/api/v1/history/calls/{r['attempt_id']}/full/"} for r in rows]
