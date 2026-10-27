import io
import csv
from django.http import HttpResponse
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from .models import Contact, SuppressionEntry, ContactImport
from .serializers import ContactSerializer, SuppressionEntrySerializer, ContactImportSerializer
from .importer import preview_import_data, execute_import
from apps.organizations.models import Organization

class ContactViewSet(viewsets.ModelViewSet):
    queryset = Contact.objects.all().order_by("-created_at")
    serializer_class = ContactSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        query = self.request.query_params.get("search", "").strip()
        if query:
            qs = qs.filter(name__icontains=query) | qs.filter(phone_number__icontains=query) | qs.filter(company__icontains=query)
        opted_out = self.request.query_params.get("opted_out")
        if opted_out is not None:
            qs = qs.filter(is_opted_out=opted_out.lower() in ("true", "1"))
        return qs

    def perform_create(self, serializer):
        org = Organization.objects.first()
        serializer.save(organization=org)

    @action(detail=False, methods=["post"], parser_classes=[MultiPartParser, FormParser])
    def preview_import(self, request):
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response({"error": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST)
        
        org = Organization.objects.first()
        try:
            preview_result = preview_import_data(org, uploaded_file, uploaded_file.name)
            return Response(preview_result)
        except Exception as e:
            return Response({"error": f"Failed to preview file: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["post"], parser_classes=[MultiPartParser, FormParser])
    def execute_import(self, request):
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response({"error": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST)
        
        org = Organization.objects.first()
        try:
            audit = execute_import(org, uploaded_file, uploaded_file.name)
            return Response(ContactImportSerializer(audit).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": f"Failed to import file: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["get"])
    def sample_template(self, request):
        """Generates a downloadable CSV sample template with valid Indian phone number examples."""
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="sevencore_conversa_contacts_template.csv"'
        
        writer = csv.writer(response)
        writer.writerow(["Name", "Phone Number", "Company", "Email", "City", "Loan Amount"])
        writer.writerow(["Aarav Sharma", "+919876543210", "Sharma Enterprises", "aarav@example.com", "Mumbai", "500000"])
        writer.writerow(["Pooja Patel", "9823012345", "Patel Healthcare", "pooja@example.com", "Ahmedabad", "250000"])
        writer.writerow(["Vikram Singh", "+918040001234", "Singh Logistics", "vikram@example.com", "Bengaluru", "1200000"])
        writer.writerow(["Ananya Iyer", "09988776655", "Iyer Consulting", "ananya@example.com", "Chennai", "750000"])
        return response

    @action(detail=False, methods=["get"])
    def export_csv(self, request):
        """Exports all contacts to a clean CSV."""
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="contacts_export.csv"'
        writer = csv.writer(response)
        writer.writerow(["Name", "Phone Number", "Company", "Email", "Consent", "Opted Out", "Notes", "Created At"])
        for c in Contact.objects.all().order_by("name"):
            writer.writerow([c.name, c.phone_number, c.company, c.email, c.has_consent, c.is_opted_out, c.notes, c.created_at])
        return response


class SuppressionEntryViewSet(viewsets.ModelViewSet):
    queryset = SuppressionEntry.objects.all().order_by("-created_at")
    serializer_class = SuppressionEntrySerializer
    permission_classes = [permissions.AllowAny]

    def perform_create(self, serializer):
        org = Organization.objects.first()
        serializer.save(organization=org)


class ContactImportViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ContactImport.objects.all().order_by("-created_at")
    serializer_class = ContactImportSerializer
    permission_classes = [permissions.AllowAny]
