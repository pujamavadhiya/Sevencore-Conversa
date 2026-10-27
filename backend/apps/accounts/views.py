from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from apps.organizations.models import Organization
from config.branding import PRODUCT_NAME
from .models import OrganizationMember
from .serializers import UserSerializer

class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = request.data.get("username", "").strip()
        password = request.data.get("password", "").strip()
        
        user = authenticate(request, username=username, password=password)
        if user is not None:
            login(request, user)
            membership = OrganizationMember.objects.filter(user=user).select_related("organization").first()
            return Response({
                "success": True,
                "user": UserSerializer(user).data,
                "organization": {
                    "id": membership.organization.id if membership else None,
                    "name": membership.organization.name if membership else "Default Org",
                    "role": membership.role if membership else "admin",
                }
            })
        return Response(
            {"success": False, "error": "Invalid username or password"},
            status=status.HTTP_401_UNAUTHORIZED
        )

class LogoutView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        logout(request)
        return Response({"success": True, "message": "Successfully logged out"})

class CurrentUserView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        if request.user.is_authenticated:
            membership = OrganizationMember.objects.filter(user=request.user).select_related("organization").first()
            return Response({
                "authenticated": True,
                "user": UserSerializer(request.user).data,
                "organization": {
                    "id": membership.organization.id if membership else None,
                    "name": membership.organization.name if membership else None,
                    "role": membership.role if membership else "admin",
                }
            })
        
        # For default demo / local dev if no session exists yet, return default admin info
        default_user = User.objects.filter(is_superuser=True).first()
        org = Organization.objects.first()
        return Response({
            "authenticated": bool(default_user),
            "user": UserSerializer(default_user).data if default_user else None,
            "organization": {
                "id": org.id if org else None,
                "name": org.name if org else f"{PRODUCT_NAME} Enterprise",
                "role": "admin",
            }
        })
