from django.conf import settings
from .base import SarvamBaseClient
from .live import SarvamLiveClient
from .mock import SarvamMockClient

def get_sarvam_client() -> SarvamBaseClient:
    """
    Factory function providing the active Sarvam client.
    Returns SarvamMockClient if SARVAM_USE_MOCK=True or if mandatory credentials are missing.
    Returns SarvamLiveClient when real credentials are configured and mock mode is False.
    """
    use_mock = getattr(settings, "SARVAM_USE_MOCK", True)
    api_key = getattr(settings, "SARVAM_API_KEY", "")
    org_id = getattr(settings, "SARVAM_ORG_ID", "")
    workspace_id = getattr(settings, "SARVAM_WORKSPACE_ID", "")
    base_url = getattr(settings, "SARVAM_API_BASE_URL", "https://apps.sarvam.ai")

    # If mock explicitly enabled or credentials incomplete, safely use mock
    if use_mock or not (api_key and org_id and workspace_id):
        return SarvamMockClient()

    return SarvamLiveClient(
        api_key=api_key,
        org_id=org_id,
        workspace_id=workspace_id,
        base_url=base_url,
    )

def get_provider_status() -> dict:
    """
    Returns transparency status regarding Sarvam AI credentials and connection mode.
    """
    client = get_sarvam_client()
    status = client.health_check()
    status["is_mock"] = client.is_mock
    status["connection_id_configured"] = bool(getattr(settings, "SARVAM_CONNECTION_ID", ""))
    status["agent_phone_number_configured"] = bool(getattr(settings, "SARVAM_AGENT_PHONE_NUMBER", ""))
    status["rented_number"] = getattr(settings, "SARVAM_AGENT_PHONE_NUMBER", "")
    return status
