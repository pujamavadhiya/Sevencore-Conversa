import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth.models import User
from apps.organizations.models import Organization
from apps.accounts.models import OrganizationMember
from apps.agents.models import VoiceAgent
from apps.contacts.models import Contact, SuppressionEntry
from apps.campaigns.models import Campaign, CampaignContact
from apps.calls.models import CallAttempt, Transcript
from config.branding import PRODUCT_NAME

def seed():
    print(f"Seeding initial data for {PRODUCT_NAME}...")

    # 1. Organization
    org, _ = Organization.objects.get_or_create(
        name=f"{PRODUCT_NAME} Technologies",
        defaults={
            "timezone": "Asia/Kolkata",
            "compliance_mode": True,
            "max_daily_budget_inr": 2500.00,
        }
    )

    # 2. Admin User
    admin_user, created = User.objects.get_or_create(
        username="admin",
        defaults={
            "email": "admin@sevencore.ai",
            "first_name": "Antigravity",
            "last_name": "Engineer",
            "is_staff": True,
            "is_superuser": True,
        }
    )
    if created:
        admin_user.set_password("admin123")
        admin_user.save()
        print("Created default admin user (username: admin, password: admin123)")

    OrganizationMember.objects.get_or_create(
        user=admin_user,
        organization=org,
        defaults={"role": "admin"}
    )

    # 3. Voice Agents
    agent_sales, _ = VoiceAgent.objects.get_or_create(
        organization=org,
        name="Priya - B2B Sales & Lead Qualification",
        defaults={
            "purpose": "sales_qualification",
            "sarvam_app_id": "app_agent_priya_sales",
            "sarvam_app_version": 1,
            "primary_language": "Hindi",
            "speaker": "meera",
            "greeting_message": "नमस्ते! मैं सेवनकोर कॉन्वर्सा से प्रिया बोल रही हूँ। क्या मैं आपसे दो मिनट बात कर सकती हूँ?",
            "system_instructions": (
                "You are Priya, a courteous and articulate B2B sales development representative for Sevencore Conversa. "
                "Inquire about their current outbound calling operations and propose a 15-minute demo."
            ),
            "is_active": True,
        }
    )

    agent_emi, _ = VoiceAgent.objects.get_or_create(
        organization=org,
        name="Rajesh - EMI & Payment Follow-up",
        defaults={
            "purpose": "emi_collection",
            "sarvam_app_id": "app_agent_rajesh_emi",
            "sarvam_app_version": 1,
            "primary_language": "Hindi",
            "speaker": "arvind",
            "greeting_message": "नमस्कार, मैं समाधान फाइनेंस से राजेश बोल रहा हूँ। क्या मेरी बात खाताधारक से हो रही है?",
            "system_instructions": "You are Rajesh, a respectful customer accounts executive reminding customers about upcoming EMI.",
            "is_active": True,
        }
    )

    agent_appointment, _ = VoiceAgent.objects.get_or_create(
        organization=org,
        name="Kavya - Appointment Confirmation",
        defaults={
            "purpose": "appointment_confirmation",
            "sarvam_app_id": "app_agent_kavya_appt",
            "sarvam_app_version": 1,
            "primary_language": "English",
            "speaker": "ananya",
            "greeting_message": "Hello, this is Kavya calling from City Hospital to confirm your medical appointment.",
            "system_instructions": "Confirm appointment time and patient availability.",
            "is_active": True,
        }
    )

    # 4. Realistic Indian Contacts
    contacts_data = [
        {"name": "Aarav Sharma", "phone_number": "+919876543210", "company": "Apex Retail Pvt Ltd", "email": "aarav@apexretail.in"},
        {"name": "Pooja Patel", "phone_number": "+919823012345", "company": "Patel Diagnostics", "email": "pooja@pateldiag.com"},
        {"name": "Vikram Singh", "phone_number": "+919811223344", "company": "Northern Logistics", "email": "vikram@nlogistics.in"},
        {"name": "Neha Gupta", "phone_number": "+919899887766", "company": "Gupta Textiles", "email": "neha@guptatex.com"},
        {"name": "Karthik Subramanian", "phone_number": "+919444011223", "company": "Southern Tech Labs", "email": "karthik@southtech.in"},
    ]

    for c in contacts_data:
        Contact.objects.get_or_create(
            organization=org,
            phone_number=c["phone_number"],
            defaults={"name": c["name"], "company": c["company"], "email": c["email"]}
        )

    # 5. DND Suppression Entry Example
    SuppressionEntry.objects.get_or_create(
        organization=org,
        phone_number="+919999999999",
        defaults={"reason": "TRAI_NDNC", "notes": "Registered with National Do Not Call registry"}
    )

    print("Seed data populated successfully.")

if __name__ == "__main__":
    seed()
