from rest_framework import serializers
from django.contrib.auth.models import User
from .models import OrganizationMember

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "is_staff"]

class OrganizationMemberSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    organization_name = serializers.CharField(source="organization.name", read_only=True)

    class Meta:
        model = OrganizationMember
        fields = ["id", "user", "organization", "organization_name", "role", "created_at"]
