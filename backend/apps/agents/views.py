from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import VoiceAgent
from .serializers import VoiceAgentSerializer
from apps.organizations.models import Organization
from apps.knowledge_base.models import KnowledgeBaseFile

VOICE_CATALOG = [
    {
        "id": "meera",
        "name": "Meera",
        "gender": "Female",
        "style": "Warm & Professional",
        "model": "Bulbul v4",
        "languages": ["Hindi", "Indian English", "Marathi"],
        "sample_text_hi": "नमस्ते! मैं सेवनकोर कॉन्वर्सा से मीरा हूँ। आज मैं आपकी क्या सहायता कर सकती हूँ?",
        "sample_text_en": "Hello! I am Meera from Sevencore Conversa. How can I assist you with your business today?",
    },
    {
        "id": "pavithra",
        "name": "Pavithra",
        "gender": "Female",
        "style": "Empathetic & Courteous",
        "model": "Bulbul v4",
        "languages": ["Hindi", "Tamil", "Telugu"],
        "sample_text_hi": "नमस्ते, मैं पवित्रा हूँ। क्या मेरी बात अपॉइंटमेंट होल्डर से हो रही है?",
        "sample_text_en": "Hello, this is Pavithra calling to confirm your upcoming appointment.",
    },
    {
        "id": "arvind",
        "name": "Arvind",
        "gender": "Male",
        "style": "Calm & Confident",
        "model": "Bulbul v4",
        "languages": ["Hindi", "Indian English", "Tamil"],
        "sample_text_hi": "नमस्कार, मैं समाधान फाइनेंस से अरविन्द बोल रहा हूँ।",
        "sample_text_en": "Hello, this is Arvind calling regarding your customer account updates.",
    },
    {
        "id": "amartya",
        "name": "Amartya",
        "gender": "Male",
        "style": "Energetic & Clear",
        "model": "Bulbul v4",
        "languages": ["Hindi", "Bengali", "Indian English"],
        "sample_text_hi": "नमस्ते! मैं अमर्त्य हूँ। क्या आप नए ऑटोमेशन फीचर्स के बारे में जानना चाहते हैं?",
        "sample_text_en": "Hi there! I am Amartya. Would you like to hear about our new voice automation capabilities?",
    },
    {
        "id": "ananya",
        "name": "Ananya",
        "gender": "Female",
        "style": "Support Specialist",
        "model": "Bulbul v4",
        "languages": ["Indian English", "Hindi"],
        "sample_text_hi": "नमस्ते, मैं अनन्या हूँ। कस्टमर सपोर्ट में आपका स्वागत है।",
        "sample_text_en": "Hello! I am Ananya from Customer Support. I hope you are having a wonderful day.",
    },
    {
        "id": "maitreyi",
        "name": "Maitreyi",
        "gender": "Female",
        "style": "Articulate & Formal",
        "model": "Bulbul v4",
        "languages": ["Hindi", "Bengali", "Gujarati"],
        "sample_text_hi": "नमस्कार! मैं मैत्रेयी हूँ। आपके प्रश्नों के समाधान के लिए उपलब्ध हूँ।",
        "sample_text_en": "Greetings! I am Maitreyi, available to assist with your operational requirements.",
    },
]

AGENT_TEMPLATES = [
    {
        "id": "tpl_sales",
        "name": "Priya - B2B Sales & Lead Qualification",
        "purpose": "sales_qualification",
        "primary_language": "Hindi",
        "speaker": "meera",
        "turn_timeout_seconds": 7,
        "max_conversation_duration_seconds": 600,
        "greeting_message": "नमस्ते! मैं सेवनकोर कॉन्वर्सा से प्रिया बोल रही हूँ। क्या मैं आपसे दो मिनट बात कर सकती हूँ?",
        "system_instructions": (
            "You are Priya, a polite, articulate B2B sales development representative for Sevencore Conversa.\n"
            "Goal: Qualify Indian business owners interested in automated voice AI calling.\n"
            "Key questions: 1. Do you currently make manual outbound calls to customers? 2. What is your daily call volume?\n"
            "If interested, ask if you can schedule a 15-minute product demonstration."
        ),
    },
    {
        "id": "tpl_appointment",
        "name": "Kavya - Clinic & Hospital Appointment Reminder",
        "purpose": "appointment_confirmation",
        "primary_language": "Hindi",
        "speaker": "pavithra",
        "turn_timeout_seconds": 6,
        "max_conversation_duration_seconds": 360,
        "greeting_message": "नमस्ते, मैं केयर क्लीनिक से काव्या बोल रही हूँ। क्या मेरी बात अपॉइंटमेंट होल्डर से हो रही है?",
        "system_instructions": (
            "You are Kavya, an empathetic medical clinic appointment coordinator.\n"
            "Goal: Confirm upcoming doctor consultation appointments.\n"
            "Verify appointment date, time, and patient availability.\n"
            "If patient wishes to reschedule, note down their preferred date."
        ),
    },
    {
        "id": "tpl_emi",
        "name": "Rajesh - EMI & Payment Follow-up",
        "purpose": "emi_collection",
        "primary_language": "Hindi",
        "speaker": "arvind",
        "turn_timeout_seconds": 8,
        "max_conversation_duration_seconds": 480,
        "greeting_message": "नमस्कार, मैं समाधान फाइनेंस से राजेश बोल रहा हूँ। क्या मेरी बात खाताधारक से हो रही है?",
        "system_instructions": (
            "You are Rajesh, a professional, respectful customer accounts executive.\n"
            "Goal: Remind customers regarding their upcoming loan EMI due date.\n"
            "Be extremely courteous, adhere strictly to RBI fair recovery guidelines, and confirm the expected date of online payment."
        ),
    },
    {
        "id": "tpl_support",
        "name": "Ananya - Customer Support & Feedback",
        "purpose": "customer_support",
        "primary_language": "English",
        "speaker": "ananya",
        "turn_timeout_seconds": 7,
        "max_conversation_duration_seconds": 900,
        "greeting_message": "Hello! I am Ananya from Customer Support. I hope you're having a pleasant day.",
        "system_instructions": (
            "You are Ananya, a helpful, patient customer support representative.\n"
            "Goal: Collect feedback regarding recent service experience or answer common inquiries."
        ),
    },
]

class VoiceAgentViewSet(viewsets.ModelViewSet):
    queryset = VoiceAgent.objects.all().prefetch_related("knowledge_files").order_by("-created_at")
    serializer_class = VoiceAgentSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        org_id = self.request.query_params.get("organization")
        if org_id:
            qs = qs.filter(organization_id=org_id)
        return qs

    def perform_create(self, serializer):
        org = None
        org_id = self.request.data.get("organization")
        if org_id:
            org = Organization.objects.filter(id=org_id).first()
        if not org:
            org = Organization.objects.first()
        agent = serializer.save(organization=org)
        
        # Link selected knowledge base files
        knowledge_file_ids = self.request.data.get("knowledge_file_ids", [])
        if knowledge_file_ids:
            KnowledgeBaseFile.objects.filter(id__in=knowledge_file_ids).update(agent=agent, status="attached")

    def perform_update(self, serializer):
        agent = serializer.save()
        if "knowledge_file_ids" in self.request.data:
            knowledge_file_ids = self.request.data.get("knowledge_file_ids", [])
            # Detach existing
            agent.knowledge_files.update(agent=None, status="parsed")
            # Attach selected
            if knowledge_file_ids:
                KnowledgeBaseFile.objects.filter(id__in=knowledge_file_ids).update(agent=agent, status="attached")

    @action(detail=False, methods=["get"])
    def templates(self, request):
        return Response(AGENT_TEMPLATES)

    @action(detail=False, methods=["get"])
    def voices(self, request):
        """Returns catalog of supported Sarvam Bulbul voices with preview sample text."""
        return Response(VOICE_CATALOG)
