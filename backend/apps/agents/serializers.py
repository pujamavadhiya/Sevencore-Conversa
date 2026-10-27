from rest_framework import serializers
from .models import VoiceAgent
from apps.knowledge_base.models import KnowledgeBaseFile

class AttachedKnowledgeFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = KnowledgeBaseFile
        fields = ["id", "name", "file_type", "status"]

class VoiceAgentSerializer(serializers.ModelSerializer):
    language_display = serializers.CharField(source="get_primary_language_display", read_only=True)
    purpose_display = serializers.CharField(source="get_purpose_display", read_only=True)
    knowledge_files = AttachedKnowledgeFileSerializer(many=True, read_only=True)

    class Meta:
        model = VoiceAgent
        fields = [
            "id",
            "organization",
            "name",
            "purpose",
            "purpose_display",
            "sarvam_app_id",
            "sarvam_app_version",
            "primary_language",
            "language_display",
            "voice_model",
            "speaker",
            "turn_timeout_seconds",
            "max_conversation_duration_seconds",
            "greeting_message",
            "system_instructions",
            "knowledge_files",
            "is_active",
            "created_at",
            "updated_at",
        ]
