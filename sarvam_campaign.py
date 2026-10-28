"""
Sarvam batch outbound campaign + follow-up handling.

Covers:
  1) Not answered            -> platform retries; if exhausted -> follow-up batch
  2) Answered, silent 10s    -> agent hangs up (agent-side) -> follow-up with reason
  3) Silent 10s mid-talk     -> agent hangs up (agent-side) -> follow-up with conversation + reason
  4) Interacted, concluded   -> agent ends call -> SUCCESS, conversation stored

Run:  uvicorn sarvam_campaign:app --port 8002
"""
from backend.sarvam_campaign import (
    app,
    create_campaign,
    stream_cohort,
    dispatch_followups,
    classify,
    Reason,
    Status,
    UserRecord,
    USERS,
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("sarvam_campaign:app", host="0.0.0.0", port=8002, reload=True)

