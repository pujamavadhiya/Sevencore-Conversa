import logging
import requests
from typing import Dict, Any, Optional
from urllib.parse import quote
from .base import SarvamBaseClient

logger = logging.getLogger(__name__)

class SarvamLiveClient(SarvamBaseClient):
    """
    Real Sarvam Voice Agents Telephony client.
    Interacts directly with official Sarvam endpoints:
    - POST https://apps.sarvam.ai/api/outbounds/v1/orgs/{org_id}/workspaces/{workspace_id}/outbounds
    - GET https://apps.sarvam.ai/api/analytics/v1/{org_id}/{workspace_id}/{app_id}/transcripts/{interaction_id}
    """

    def __init__(
        self,
        api_key: str,
        org_id: str,
        workspace_id: str,
        base_url: str = "https://apps.sarvam.ai",
        timeout: int = 15,
    ):
        self.api_key = api_key
        self.org_id = org_id
        self.workspace_id = workspace_id
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    @property
    def is_mock(self) -> bool:
        return False

    def _headers(self) -> Dict[str, str]:
        return {
            "X-API-Key": self.api_key,
            "Content-Type": "application/json",
            "User-Agent": "SevencoreConversa-Caller/1.0",
        }

    def initiate_outbound_call(
        self,
        app_id: str,
        app_version: int,
        connection_id: str,
        agent_phone_number: str,
        user_phone_number: str,
        agent_variables: Optional[Dict[str, Any]] = None,
        initial_bot_message: Optional[str] = None,
        initial_language_name: Optional[str] = None,
        webhook_url: Optional[str] = None,
        webhook_metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        endpoint = f"{self.base_url}/api/outbounds/v1/orgs/{self.org_id}/workspaces/{self.workspace_id}/outbounds"
        
        app_config: Dict[str, Any] = {
            "app_id": app_id,
            "app_version": app_version,
            "connection_config": {
                "connection_id": connection_id,
                "agent_phone_number": agent_phone_number,
            },
            "agent_variables": agent_variables or {},
            "app_type": "agent",
        }

        # Optional overrides
        app_overrides = {}
        if initial_bot_message:
            app_overrides["initial_bot_message"] = initial_bot_message
        if initial_language_name:
            app_overrides["initial_language_name"] = initial_language_name
        if app_overrides:
            app_config["app_overrides"] = app_overrides

        payload: Dict[str, Any] = {
            "app_config": app_config,
            "user_config": {
                "user_phone_number": user_phone_number,
            },
        }

        if webhook_url:
            payload["webhook_config"] = {
                "url": webhook_url,
                "metadata": webhook_metadata or {},
            }

        try:
            # Mask phone number in debug logs for privacy
            masked_phone = user_phone_number[:5] + "XXXX" + user_phone_number[-2:] if len(user_phone_number) >= 8 else "***"
            logger.info("Initiating Sarvam outbound call to %s (app_id: %s)", masked_phone, app_id)

            resp = requests.post(endpoint, json=payload, headers=self._headers(), timeout=self.timeout)
            
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "success": True,
                    "attempt_id": data.get("attempt_id"),
                    "raw_response": data,
                }
            elif resp.status_code == 422:
                err_data = resp.json()
                return {
                    "success": False,
                    "error": "Validation error from Sarvam: " + str(err_data.get("detail", resp.text)),
                    "status_code": 422,
                }
            else:
                return {
                    "success": False,
                    "error": f"Sarvam API error (HTTP {resp.status_code}): {resp.text}",
                    "status_code": resp.status_code,
                }
        except requests.RequestException as exc:
            logger.error("Sarvam API request failed: %s", exc)
            return {
                "success": False,
                "error": f"Network error connecting to Sarvam: {str(exc)}",
            }

    def get_transcript(self, app_id: str, interaction_id: str) -> Dict[str, Any]:
        # Interaction ID format is <YYYYMMDD>/<uuid>
        encoded_id = quote(interaction_id, safe="")
        endpoint = f"{self.base_url}/api/analytics/v1/{self.org_id}/{self.workspace_id}/{app_id}/transcripts/{encoded_id}"
        
        try:
            resp = requests.get(endpoint, headers=self._headers(), timeout=self.timeout)
            if resp.status_code == 200:
                return {
                    "success": True,
                    "data": resp.json(),
                }
            return {
                "success": False,
                "error": f"Sarvam Transcript error (HTTP {resp.status_code}): {resp.text}",
            }
        except requests.RequestException as exc:
            return {
                "success": False,
                "error": f"Network error fetching transcript: {str(exc)}",
            }

    def create_campaign(
        self,
        name: str,
        app_id: str,
        app_version: int,
        connection_id: str,
        from_number: str,
        webhook_url: str,
        webhook_secret: str,
        start_iso: Optional[str] = None,
        end_iso: Optional[str] = None,
        attempts_per_second: float = 0.5,
    ) -> Dict[str, Any]:
        endpoint = f"{self.base_url}/api/scheduling/v1/orgs/{self.org_id}/workspaces/{self.workspace_id}/campaigns"
        
        # Default start/end window if omitted: 5 minutes from now to 7 days from now
        import datetime
        now = datetime.datetime.now(datetime.timezone.utc)
        if not start_iso:
            start_iso = (now + datetime.timedelta(minutes=5)).strftime("%Y-%m-%dT%H:%M:%SZ")
        if not end_iso:
            end_iso = (now + datetime.timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%SZ")

        body = {
            "name": name,
            "app_config": {
                "app_id": app_id,
                "app_version": app_version,
                "app_type": "agent",
                "attempts_per_second": attempts_per_second,
                "connection_configs": [{"connection_id": connection_id, "phone_numbers": [from_number]}],
                "retry_config": {
                    "max_retries": 2,
                    "retry_interval_minutes": [30, 120],
                    "retry_on": {
                        "busy": {"enabled": True},
                        "no_answer": {"enabled": True},
                        "short_duration": {"enabled": False},
                    },
                },
                "webhook_config": {
                    "url": webhook_url,
                    "headers": {"X-Webhook-Secret": webhook_secret} if webhook_secret else {},
                },
            },
            "start_timestamp": start_iso,
            "end_timestamp": end_iso,
            "allowed_schedule": {
                "timezone": "Asia/Kolkata",
                "allowed_start_time": "09:00",
                "allowed_end_time": "18:00",
                "allowed_days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
            },
        }

        try:
            resp = requests.post(endpoint, json=body, headers=self._headers(), timeout=self.timeout)
            if resp.status_code in (200, 201):
                data = resp.json()
                return {"success": True, "campaign_id": data.get("campaign_id") or data.get("id"), "data": data}
            return {"success": False, "error": f"Sarvam create campaign error (HTTP {resp.status_code}): {resp.text}"}
        except requests.RequestException as exc:
            return {"success": False, "error": f"Network error creating Sarvam campaign: {str(exc)}"}

    def stream_cohort(
        self,
        campaign_id: str,
        cohort_name: str,
        users: list,
    ) -> Dict[str, Any]:
        endpoint = f"{self.base_url}/api/scheduling/v1/orgs/{self.org_id}/workspaces/{self.workspace_id}/campaigns/{campaign_id}/cohorts/stream"
        chunk_size = 1000
        cohort_ids = []

        try:
            import re
            for i in range(0, len(users), chunk_size):
                chunk = users[i : i + chunk_size]
                clean_name = re.sub(r"[^\w\- ]", "-", f"{cohort_name}-{i // chunk_size + 1}")[:50]
                resp = requests.post(
                    endpoint,
                    json={"name": clean_name, "users": chunk},
                    headers=self._headers(),
                    timeout=self.timeout + 15,
                )
                if resp.status_code in (200, 201):
                    c_id = resp.json().get("cohort_id") or resp.json().get("id")
                    if c_id:
                        cohort_ids.append(c_id)
                else:
                    return {"success": False, "error": f"Failed streaming cohort chunk {clean_name}: {resp.text}"}

            return {"success": True, "cohort_ids": cohort_ids}
        except requests.RequestException as exc:
            return {"success": False, "error": f"Network error streaming cohort: {str(exc)}"}

    def health_check(self) -> Dict[str, Any]:
        if not self.api_key:
            return {"configured": False, "reason": "Missing SARVAM_API_KEY"}
        if not self.org_id or not self.workspace_id:
            return {"configured": False, "reason": "Missing SARVAM_ORG_ID or SARVAM_WORKSPACE_ID"}
        return {
            "configured": True,
            "org_id": self.org_id,
            "workspace_id": self.workspace_id,
            "provider": "Sarvam AI Voice Agents (Live)",
            "base_url": self.base_url,
        }
