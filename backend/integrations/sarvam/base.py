from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

class SarvamBaseClient(ABC):
    @property
    @abstractmethod
    def is_mock(self) -> bool:
        """Indicates whether this is a simulated mock provider or real live Sarvam connection."""
        pass

    @abstractmethod
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
        """
        Dispatches an instant outbound call to Sarvam Voice Agents API.
        Returns a dictionary containing 'attempt_id' and provider status.
        """
        pass

    @abstractmethod
    def get_transcript(
        self,
        app_id: str,
        interaction_id: str
    ) -> Dict[str, Any]:
        """
        Retrieves turn-by-turn transcript for a completed interaction.
        """
        pass

    @abstractmethod
    def health_check(self) -> Dict[str, Any]:
        """
        Validates credentials and connection readiness.
        """
        pass
