from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from .models import KnowledgeBaseFile
from .serializers import KnowledgeBaseFileSerializer
from .scraper import scrape_website_url
from apps.organizations.models import Organization
from apps.agents.models import VoiceAgent

ALLOWED_EXTENSIONS = {"pdf", "txt", "csv", "docx"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

class KnowledgeBaseViewSet(viewsets.ModelViewSet):
    queryset = KnowledgeBaseFile.objects.all().order_by("-created_at")
    serializer_class = KnowledgeBaseFileSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category=category)
        agent_id = self.request.query_params.get("agent")
        if agent_id:
            qs = qs.filter(agent_id=agent_id)
        return qs

    def create(self, request, *args, **kwargs):
        """
        Unified endpoint that handles all 3 categories:
        1. 'site': paste website URL to scrape data and feed to agent
        2. 'document': upload file (PDF, TXT, CSV)
        3. 'text': paste raw notes/FAQs/data directly
        """
        category = request.data.get("category", "").lower()
        org = Organization.objects.first()
        agent_id = request.data.get("agent") or request.data.get("agent_id")
        agent = VoiceAgent.objects.filter(id=agent_id).first() if agent_id else None

        # ----------------------------------------------------
        # 1. SITES CATEGORY: Scrape URL
        # ----------------------------------------------------
        if category == "site" or "url" in request.data:
            url = request.data.get("url", "").strip()
            if not url:
                return Response({"error": "Please provide a valid website URL to scrape."}, status=status.HTTP_400_BAD_REQUEST)

            custom_name = request.data.get("name", "").strip()

            try:
                scraped = scrape_website_url(url)
            except Exception as e:
                return Response(
                    {"error": f"Failed to scrape website: {str(e)}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            item_name = custom_name or scraped["title"] or url
            kb_entry = KnowledgeBaseFile.objects.create(
                organization=org,
                agent=agent,
                name=item_name[:255],
                category="site",
                source_url=scraped["url"],
                file_type="WEB",
                file_size_bytes=scraped["char_count"],
                raw_text=scraped["text"],
                content_summary=scraped["summary"],
                word_count=scraped["word_count"],
                status="attached" if agent else "parsed",
            )
            return Response(KnowledgeBaseFileSerializer(kb_entry).data, status=status.HTTP_201_CREATED)

        # ----------------------------------------------------
        # 2. PASTE DATA CATEGORY: Direct Text / Notes / FAQs
        # ----------------------------------------------------
        elif category == "text" or ("text" in request.data and "file" not in request.FILES):
            raw_text = request.data.get("text", "").strip()
            if not raw_text:
                return Response({"error": "Pasted text content cannot be empty."}, status=status.HTTP_400_BAD_REQUEST)

            name = request.data.get("name", "").strip() or "Custom Knowledge Notes"
            words = len(raw_text.split())
            summary = raw_text[:350].replace("\n", " ").strip()

            kb_entry = KnowledgeBaseFile.objects.create(
                organization=org,
                agent=agent,
                name=name[:255],
                category="text",
                file_type="TEXT",
                file_size_bytes=len(raw_text.encode("utf-8")),
                raw_text=raw_text,
                content_summary=summary,
                word_count=words,
                status="attached" if agent else "parsed",
            )
            return Response(KnowledgeBaseFileSerializer(kb_entry).data, status=status.HTTP_201_CREATED)

        # ----------------------------------------------------
        # 3. DOCUMENT UPLOAD CATEGORY: PDF / TXT / CSV Files
        # ----------------------------------------------------
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response(
                {"error": "Please provide a website URL, paste text data, or upload a document file."},
                status=status.HTTP_400_BAD_REQUEST
            )

        filename = uploaded_file.name
        ext = filename.split(".")[-1].lower() if "." in filename else ""
        if ext not in ALLOWED_EXTENSIONS:
            return Response(
                {"error": f"Invalid file format: .{ext}. Allowed formats are: PDF, TXT, CSV."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if uploaded_file.size > MAX_FILE_SIZE_BYTES:
            return Response(
                {"error": f"File exceeds maximum allowed size of 10MB ({uploaded_file.size} bytes)."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Content extraction & preview
        extracted_text = ""
        try:
            sample_bytes = uploaded_file.read(min(uploaded_file.size, 100000))
            uploaded_file.seek(0)
            if ext in ("txt", "csv"):
                extracted_text = sample_bytes.decode("utf-8", errors="ignore")
            elif ext == "pdf":
                if not sample_bytes.startswith(b"%PDF"):
                    return Response({"error": "Malformed PDF header."}, status=status.HTTP_400_BAD_REQUEST)
                extracted_text = f"Valid PDF binary stream: {filename} ({uploaded_file.size} bytes)"
        except Exception as e:
            return Response({"error": f"Could not parse file content: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

        words = len(extracted_text.split()) if extracted_text else 0
        summary_preview = extracted_text[:350].replace("\n", " ").strip()

        kb_entry = KnowledgeBaseFile.objects.create(
            organization=org,
            agent=agent,
            name=filename,
            category="document",
            file_type=ext.upper(),
            file_size_bytes=uploaded_file.size,
            file=uploaded_file,
            raw_text=extracted_text,
            content_summary=f"Extracted content: {summary_preview}",
            word_count=words,
            status="attached" if agent else "parsed",
        )

        return Response(KnowledgeBaseFileSerializer(kb_entry).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="scrape-site")
    def scrape_site(self, request):
        """Dedicated action to scrape a website URL and feed into knowledge base."""
        url = request.data.get("url", "").strip()
        if not url:
            return Response({"error": "URL parameter is required."}, status=status.HTTP_400_BAD_REQUEST)
        
        agent_id = request.data.get("agent_id")
        agent = VoiceAgent.objects.filter(id=agent_id).first() if agent_id else None
        custom_name = request.data.get("name", "").strip()

        try:
            scraped = scrape_website_url(url)
        except Exception as e:
            return Response({"error": f"Website scraping failed: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

        org = Organization.objects.first()
        kb_entry = KnowledgeBaseFile.objects.create(
            organization=org,
            agent=agent,
            name=custom_name or scraped["title"] or url,
            category="site",
            source_url=scraped["url"],
            file_type="WEB",
            file_size_bytes=scraped["char_count"],
            raw_text=scraped["text"],
            content_summary=scraped["summary"],
            word_count=scraped["word_count"],
            status="attached" if agent else "parsed",
        )
        return Response(KnowledgeBaseFileSerializer(kb_entry).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="paste-text")
    def paste_text(self, request):
        """Dedicated action to directly paste raw knowledge notes / FAQs."""
        text = request.data.get("text", "").strip()
        if not text:
            return Response({"error": "Pasted text content is required."}, status=status.HTTP_400_BAD_REQUEST)
        
        name = request.data.get("name", "").strip() or "Custom Knowledge Notes"
        agent_id = request.data.get("agent_id")
        agent = VoiceAgent.objects.filter(id=agent_id).first() if agent_id else None

        org = Organization.objects.first()
        words = len(text.split())
        kb_entry = KnowledgeBaseFile.objects.create(
            organization=org,
            agent=agent,
            name=name[:255],
            category="text",
            file_type="TEXT",
            file_size_bytes=len(text.encode("utf-8")),
            raw_text=text,
            content_summary=text[:350].replace("\n", " ").strip(),
            word_count=words,
            status="attached" if agent else "parsed",
        )
        return Response(KnowledgeBaseFileSerializer(kb_entry).data, status=status.HTTP_201_CREATED)
