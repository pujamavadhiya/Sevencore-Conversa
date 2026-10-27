import datetime
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from apps.organizations.models import Organization
from apps.agents.models import VoiceAgent
from apps.contacts.models import Contact, SuppressionEntry, normalize_indian_phone
from apps.contacts.importer import validate_indian_mobile
from apps.campaigns.models import Campaign, CampaignContact
from apps.campaigns.engine import CampaignExecutionEngine
from apps.calls.models import CallAttempt, Transcript
from integrations.sarvam.factory import get_sarvam_client, get_provider_status
from integrations.sarvam.compliance import check_number_compliance

class SevencoreConversaBackendTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(
            name="Test Indian Corp",
            timezone="Asia/Kolkata",
            compliance_mode=True,
            max_daily_budget_inr=1000.00,
        )
        self.agent = VoiceAgent.objects.create(
            organization=self.org,
            name="Test Priya Agent",
            purpose="sales_qualification",
            sarvam_app_id="app_test_1",
            sarvam_app_version=1,
            primary_language="Hindi",
            greeting_message="नमस्ते! टेस्ट कॉल।",
            system_instructions="Test prompt instructions.",
        )
        self.contact = Contact.objects.create(
            organization=self.org,
            name="Vikram Test",
            phone_number="+919876543210",
            company="Test Logistics",
        )

    def test_indian_phone_normalization(self):
        # 10 digits
        self.assertEqual(normalize_indian_phone("9876543210"), "+919876543210")
        # 0 prefix (11 digits)
        self.assertEqual(normalize_indian_phone("09876543210"), "+919876543210")
        # +91 prefix
        self.assertEqual(normalize_indian_phone("+919876543210"), "+919876543210")
        # Formatted with spaces / dashes
        self.assertEqual(normalize_indian_phone("+91 98765-43210"), "+919876543210")

    def test_indian_mobile_validator(self):
        valid, res = validate_indian_mobile("+919876543210")
        self.assertTrue(valid)
        self.assertEqual(res, "+919876543210")

        # Invalid short
        invalid, err = validate_indian_mobile("12345")
        self.assertFalse(invalid)

    def test_dnd_suppression_registry(self):
        SuppressionEntry.objects.create(
            organization=self.org,
            phone_number="+919999888877",
            reason="TRAI_NDNC"
        )
        
        # Check suppressed number
        eligible, reason = check_number_compliance(self.org, "+919999888877")
        self.assertFalse(eligible)
        self.assertIn("DND", reason)

        # Check clean contact
        clean_eligible, _ = check_number_compliance(self.org, self.contact.phone_number)
        self.assertTrue(clean_eligible)

    def test_campaign_mandatory_confirmation_guard(self):
        campaign = Campaign.objects.create(
            organization=self.org,
            name="Q4 Sales Campaign",
            agent=self.agent,
            is_confirmed=False,  # Unconfirmed!
        )
        CampaignContact.objects.create(
            campaign=campaign,
            contact=self.contact,
            status="pending"
        )

        res = CampaignExecutionEngine.validate_and_start(campaign, bypass_hours_check=True)
        self.assertFalse(res["success"])
        self.assertIn("Explicit user launch confirmation is required", res["error"])

    def test_mock_sarvam_dispatch_and_transparency(self):
        client = get_sarvam_client()
        self.assertTrue(client.is_mock)

        campaign = Campaign.objects.create(
            organization=self.org,
            name="Confirmed Pilot Campaign",
            agent=self.agent,
            is_confirmed=True,
        )
        cc = CampaignContact.objects.create(
            campaign=campaign,
            contact=self.contact,
            status="pending"
        )

        res = CampaignExecutionEngine.validate_and_start(campaign, bypass_hours_check=True)
        self.assertTrue(res["success"])
        self.assertEqual(res["dispatched_count"], 1)

        # Check call attempt
        attempt = CallAttempt.objects.filter(campaign=campaign).first()
        self.assertIsNotNone(attempt)
        self.assertTrue(attempt.is_mock)
        self.assertTrue(attempt.sarvam_attempt_id.startswith("mock_attempt_"))
        
        # Check transcript generation
        transcript = Transcript.objects.filter(call_attempt=attempt).first()
        if attempt.status == "connected":
            self.assertIsNotNone(transcript)
            self.assertGreater(len(transcript.messages), 0)
            self.assertGreater(attempt.cost_inr, Decimal("0.00"))

    def test_idempotent_duplicate_call_prevention(self):
        campaign = Campaign.objects.create(
            organization=self.org,
            name="Idempotency Test",
            agent=self.agent,
            is_confirmed=True,
        )
        cc = CampaignContact.objects.create(
            campaign=campaign,
            contact=self.contact,
            status="calling"  # already in progress!
        )
        # Attempting second dispatch must not create duplicate CallAttempt
        initial_calls = CallAttempt.objects.count()
        res = CampaignExecutionEngine.dispatch_pending_batch(campaign)
        self.assertEqual(CallAttempt.objects.count(), initial_calls)

    def test_cost_calculation(self):
        attempt = CallAttempt.objects.create(
            organization=self.org,
            contact=self.contact,
            agent=self.agent,
            user_phone_number="+919876543210",
            duration_seconds=90.0,  # 1.5 minutes
        )
        attempt.calculate_cost(rate_per_min_inr=3.50)
        # 1.5 * 3.50 = 5.2500 INR
        self.assertEqual(attempt.cost_inr, Decimal("5.2500"))
