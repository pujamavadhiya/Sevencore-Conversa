from rest_framework import serializers
from .models import KnowledgeBaseFile

class KnowledgeBaseFileSerializer(serializers.ModelSerializer):
    agent_name = serializers.CharField(source="agent.name", read_only=True)
    category_display = serializers.CharField(source="get_category_display", read_only=True)

    class Meta:
        model = KnowledgeBaseFile
        fields = [
            "id",
            "organization",
            "agent",
            "agent_name",
            "name",
            "category",
            "category_display",
            "source_url",
            "file_type",
            "file_size_bytes",
            "file",
            "raw_text",
            "content_summary",
            "word_count",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["content_summary", "file_size_bytes", "word_count"]
