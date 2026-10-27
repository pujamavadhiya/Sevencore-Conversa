import uuid
import random
import datetime
from typing import Dict, Any, Optional
from .base import SarvamBaseClient

class SarvamMockClient(SarvamBaseClient):
    """
    Mock Sarvam Voice Agents provider for local development, demoing, and automated tests.
    Explicitly labeled as MOCK_SIMULATION across all logs, data fields, and responses.
    """

    @property
    def is_mock(self) -> bool:
        return True

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
        Simulates an outbound call submission without incurring any provider charges or dialing real numbers.
        """
        simulated_attempt_id = f"mock_attempt_{uuid.uuid4().hex[:12]}"
        
        return {
            "success": True,
            "attempt_id": simulated_attempt_id,
            "is_mock": True,
            "message": "[MOCK SIMULATION] Call scheduled via mock provider. No real telecom line was used.",
            "raw_response": {
                "attempt_id": simulated_attempt_id,
                "provider": "Sarvam Voice Agents (Mock Engine)",
            }
        }

    def simulate_call_completion(
        self,
        attempt_id: str,
        contact_name: str = "Customer",
        language: str = "Hindi",
        purpose: str = "sales_qualification",
    ) -> Dict[str, Any]:
        """
        Generates realistic simulated outcome and transcript turns matching Sarvam's official webhook schema.
        """
        # 80% connected, 10% no_answer, 5% busy, 5% ndnc
        dice = random.random()
        today_str = datetime.date.today().strftime("%Y%m%d")
        interaction_id = f"{today_str}/{uuid.uuid4().hex[:16]}"
        
        if dice < 0.75:
            status = "connected"
            duration = round(random.uniform(25.0, 95.0), 2)
            failure_reason = None
            
            # Generate realistic turns based on language & purpose
            if "Hindi" in language:
                messages = [
                    {
                        "turn_id": 1,
                        "role": "assistant",
                        "content": f"नमस्ते {contact_name} जी, मैं सेवनकोर कॉन्वर्सा असिस्टेंट बोल रही हूँ। क्या अभी दो मिनट बात करने का सही समय है?",
                        "language_name": "Hindi",
                    },
                    {
                        "turn_id": 2,
                        "role": "user",
                        "content": "हाँ जी बोलिए, किस बारे में बात करनी है?",
                        "language_name": "Hindi",
                    },
                    {
                        "turn_id": 3,
                        "role": "assistant",
                        "content": "हम आपके बिज़नेस के लिए AI वॉइस कॉलिंग ऑटोमेशन के बारे में जानकारी दे रहे हैं। क्या आप एक फ्री डेमो शेड्यूल करना चाहेंगे?",
                        "language_name": "Hindi",
                    },
                    {
                        "turn_id": 4,
                        "role": "user",
                        "content": "हाँ बिल्कुल, कल दोपहर में कॉल कर सकते हैं।",
                        "language_name": "Hindi",
                    },
                    {
                        "turn_id": 5,
                        "role": "assistant",
                        "content": "बहुत बढ़िया! मैंने कल दोपहर के लिए फॉलो-अप नोट कर लिया है। आपका बहुत धन्यवाद, शुभ दिन!",
                        "language_name": "Hindi",
                    },
                ]
                disposition = "Interested - Demo Requested"
                summary = f"{contact_name} confirmed interest in voice automation and agreed to a follow-up demo tomorrow afternoon."
            else:
                messages = [
                    {
                        "turn_id": 1,
                        "role": "assistant",
                        "content": f"Hello {contact_name}, this is Sevencore Conversa calling. Do you have a quick minute to chat?",
                        "language_name": "English",
                    },
                    {
                        "turn_id": 2,
                        "role": "user",
                        "content": "Yes, please tell me what this is regarding.",
                        "language_name": "English",
                    },
                    {
                        "turn_id": 3,
                        "role": "assistant",
                        "content": "We provide AI calling automation for Indian enterprises. Would you like to evaluate a quick demonstration?",
                        "language_name": "English",
                    },
                    {
                        "turn_id": 4,
                        "role": "user",
                        "content": "Sounds good. Please send details and schedule a call.",
                        "language_name": "English",
                    },
                ]
                disposition = "Interested - Details Requested"
                summary = f"{contact_name} expressed interest and requested more information."
                
        elif dice < 0.88:
            status = "no_answer"
            duration = 0.0
            failure_reason = "No answer after 30 seconds ringing"
            messages = []
            disposition = "Unanswered"
            summary = "Call rang until timeout; recipient did not pick up."
            interaction_id = None
        elif dice < 0.94:
            status = "busy"
            duration = 0.0
            failure_reason = "User line is busy"
            messages = []
            disposition = "Line Busy"
            summary = "Call failed because recipient's line was engaged."
            interaction_id = None
        else:
            status = "failed"
            duration = 0.0
            failure_reason = "exotel: Phone number is registered under TRAI NDNC"
            messages = []
            disposition = "TRAI NDNC Suppressed"
            summary = "Call blocked at telephony gateway due to National Do Not Call registry preference."
            interaction_id = None

        return {
            "attempt_id": attempt_id,
            "status": status,
            "duration": duration,
            "interaction_id": interaction_id,
            "failure_reason": failure_reason,
            "messages": messages,
            "disposition": disposition,
            "summary": summary,
            "is_mock": True,
            "final_agent_variables": {
                "caller_name": contact_name,
                "interest_level": "High" if status == "connected" else "Unknown",
                "simulation": True,
            }
        }

    def get_transcript(self, app_id: str, interaction_id: str) -> Dict[str, Any]:
        return {
            "success": True,
            "is_mock": True,
            "data": {
                "interaction_id": interaction_id,
                "messages": [
                    {"turn_id": 1, "role": "assistant", "content": "[Mock Transcript] Hello, this was a simulated call.", "language_name": "English"},
                    {"turn_id": 2, "role": "user", "content": "[Mock Transcript] Acknowledged.", "language_name": "English"}
                ]
            }
        }

    def health_check(self) -> Dict[str, Any]:
        return {
            "configured": True,
            "provider": "Sarvam AI Voice Agents (Mock Simulation Engine)",
            "mode": "mock",
            "message": "Local development mock engine is active. No real calls will be placed.",
        }
