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

    def test_knowledge_base_categories(self):
        from apps.knowledge_base.models import KnowledgeBaseFile

        # 1. Test Text Paste
        kb_text = KnowledgeBaseFile.objects.create(
            organization=self.org,
            agent=self.agent,
            name="Product Pricing Notes",
            category="text",
            raw_text="Sevencore Conversa pricing: Basic plan is ₹4,999/mo with 1,500 calling minutes.",
            content_summary="Basic plan is ₹4,999/mo with 1,500 calling minutes.",
            word_count=10,
            status="attached",
        )
        self.assertEqual(kb_text.category, "text")
        self.assertEqual(kb_text.agent, self.agent)

        # 2. Test Website Scraping Category Entry
        kb_site = KnowledgeBaseFile.objects.create(
            organization=self.org,
            agent=self.agent,
            name="Sevencore Documentation",
            category="site",
            source_url="https://sevencore.ai/docs",
            raw_text="Enterprise Voice AI documentation and Indian telecom guidelines.",
            content_summary="Enterprise Voice AI documentation.",
            word_count=8,
            status="attached",
        )
        self.assertEqual(kb_site.category, "site")
        self.assertEqual(kb_site.source_url, "https://sevencore.ai/docs")
        self.assertEqual(self.agent.knowledge_files.count(), 2)

    def test_sarvam_campaign_followup_classification_and_cohort_dispatch(self):
        """Tests the 4 outcome classifications and intelligent follow-up cohort generation."""
        camp = Campaign.objects.create(
            organization=self.org,
            name="Follow-up Engine Test Campaign",
            agent=self.agent,
            is_confirmed=True,
        )
        cc = CampaignContact.objects.create(campaign=camp, contact=self.contact, status="pending")

        # 1. Test Silent after pickup 10s
        payload_silent_pickup = {
            "status": "connected",
            "completion_status": "incompleted",
            "final_agent_variables": {"call_outcome": "silent_after_pickup"},
        }
        status_val, reason_val = CampaignExecutionEngine.classify_call_outcome(payload_silent_pickup)
        self.assertEqual(status_val, "followup_pending")
        self.assertEqual(reason_val, "silent_after_pickup_10s")

        # 2. Test Silent mid-conversation 10s with transcript
        payload_silent_mid = {
            "status": "connected",
            "completion_status": "incompleted",
            "final_agent_variables": {"call_outcome": "silent_mid_conversation"},
            "interaction_transcript": [
                {"role": "assistant", "en_text": "Hello Vikram, calling about our software."},
                {"role": "user", "en_text": "How much does it cost?"},
            ],
        }
        CampaignExecutionEngine.process_contact_followup_outcome(cc, payload_silent_mid)
        cc.refresh_from_db()
        self.assertEqual(cc.followup_status, "followup_pending")
        self.assertEqual(cc.followup_reason, "silent_mid_conversation_10s")
        self.assertIn("How much does it cost?", cc.previous_conversation)
        self.assertIsNotNone(cc.followup_eligible_at)

        # 3. Test follow-up cohort dispatch when eligible
        cc.followup_eligible_at = timezone.now() - datetime.timedelta(minutes=5)
        cc.save()

        res = CampaignExecutionEngine.dispatch_followup_cohort(camp)
        self.assertTrue(res["success"])
        self.assertEqual(res["queued"], 1)

        cc.refresh_from_db()
        self.assertEqual(cc.followup_status, "followup_queued")
        self.assertEqual(cc.followup_round, 1)

        # 4. Test Success Concluded
        payload_success = {
            "status": "connected",
            "completion_status": "completed",
            "final_agent_variables": {"call_outcome": "success"},
        }
        status_succ, reason_succ = CampaignExecutionEngine.classify_call_outcome(payload_success)
        self.assertEqual(status_succ, "success")
        self.assertIsNone(reason_succ)

    def test_sarvam_history_pipeline_and_endpoints(self):
        from sarvam_history import ingest_webhook, register_campaign
        from rest_framework.test import APIClient

        client = APIClient()

        # 1. Register a test campaign in history
        camp_id = "camp_hist_test_1"
        register_campaign(
            campaign_id=camp_id,
            name="Q3 Product Recall Campaign",
            agent_id="agent_rec_001",
            start_iso="2026-10-28T10:00:00Z",
            end_iso="2026-10-28T18:00:00Z",
        )

        # 2. Ingest campaign call webhook
        camp_webhook = {
            "attempt_id": "att_camp_991",
            "interaction_id": "ix_camp_991",
            "campaign_id": camp_id,
            "user_identifier": "usr_vikram_42",
            "to_number": "+919876543210",
            "status": "completed",
            "disposition": "completed",
            "duration": 48.5,
            "agent_id": "agent_rec_001",
            "agent_version": 1,
            "final_agent_variables": {"call_outcome": "success"},
        }
        ingest_webhook(camp_webhook)

        # 3. Ingest single call webhook
        single_webhook = {
            "attempt_id": "att_single_881",
            "interaction_id": "ix_single_881",
            "phone": "+919123456789",
            "status": "completed",
            "disposition": "completed",
            "duration": 22.0,
            "app_id": "app_instant_1",
            "app_version": 1,
        }
        ingest_webhook(single_webhook)

        # Verify campaigns API
        resp_camps = client.get("/api/v1/history/campaigns/")
        self.assertEqual(resp_camps.status_code, 200)
        camps_data = resp_camps.json()
        matching = [c for c in camps_data if c["campaign_id"] == camp_id]
        self.assertEqual(len(matching), 1)
        self.assertEqual(matching[0]["name"], "Q3 Product Recall Campaign")
        self.assertEqual(matching[0]["total_attempts"], 1)

        # Verify campaign calls drilldown API
        resp_camp_calls = client.get(f"/api/v1/history/campaigns/{camp_id}/calls/")
        self.assertEqual(resp_camp_calls.status_code, 200)
        camp_calls = resp_camp_calls.json()
        self.assertEqual(camp_calls["total"], 1)
        self.assertEqual(len(camp_calls["items"]), 1)
        self.assertEqual(camp_calls["items"][0]["attempt_id"], "att_camp_991")
        self.assertEqual(camp_calls["items"][0]["user_identifier"], "usr_vikram_42")

        # Verify user attempts in campaign
        resp_user_attempts = client.get(f"/api/v1/history/campaigns/{camp_id}/users/usr_vikram_42/")
        self.assertEqual(resp_user_attempts.status_code, 200)
        user_calls = resp_user_attempts.json()
        self.assertEqual(user_calls["total"], 1)
        self.assertEqual(user_calls["items"][0]["attempt_id"], "att_camp_991")

        # Verify single calls API
        resp_single = client.get("/api/v1/history/single-calls/")
        self.assertEqual(resp_single.status_code, 200)
        single_calls = resp_single.json()
        self.assertGreaterEqual(single_calls["total"], 1)
        single_matching = [c for c in single_calls["items"] if c["attempt_id"] == "att_single_881"]
        self.assertEqual(len(single_matching), 1)
        self.assertEqual(single_matching[0]["call_type"], "single")

        # Verify single call detail
        resp_detail = client.get("/api/v1/history/calls/att_single_881/")
        self.assertEqual(resp_detail.status_code, 200)
        detail = resp_detail.json()
        self.assertEqual(detail["attempt_id"], "att_single_881")

    def test_scheduled_campaign_workflow(self):
        from rest_framework.test import APIClient
        client = APIClient()

        # 1. Create a campaign with scheduled_start_time in future
        future_time = timezone.now() + datetime.timedelta(hours=2)
        camp = Campaign.objects.create(
            organization=self.org,
            name="Scheduled VIP Outreach",
            agent=self.agent,
            scheduled_start_time=future_time,
            calling_window_start=datetime.time(9, 0),
            calling_window_end=datetime.time(20, 0),
        )
        CampaignContact.objects.create(campaign=camp, contact=self.contact, status="pending")

        # 2. Launch with confirm=True (should move to status='scheduled' instead of running)
        resp_launch = client.post(f"/api/v1/campaigns/{camp.id}/launch/", {"confirm": True})
        self.assertEqual(resp_launch.status_code, 200)
        self.assertEqual(resp_launch.json()["status"], "scheduled")

        camp.refresh_from_db()
        self.assertEqual(camp.status, "scheduled")

        # 3. Test force-start now
        resp_start_now = client.post(f"/api/v1/campaigns/{camp.id}/start_now/", {"bypass_hours": True})
        self.assertEqual(resp_start_now.status_code, 200)
        self.assertTrue(resp_start_now.json().get("success"))

        camp.refresh_from_db()
        self.assertIn(camp.status, ["running", "completed"])

    def test_edit_campaign_and_add_contacts(self):
        from rest_framework.test import APIClient
        client = APIClient()

        # 1. Create a draft campaign
        camp = Campaign.objects.create(
            organization=self.org,
            name="Draft Campaign For Editing",
            agent=self.agent,
            calling_window_start=datetime.time(9, 0),
            calling_window_end=datetime.time(20, 0),
            status="draft",
        )

        # 2. Edit campaign via PATCH
        resp_patch = client.patch(f"/api/v1/campaigns/{camp.id}/", {
            "name": "Updated Campaign Title",
            "calls_per_second": 4,
            "max_retries": 3,
        })
        self.assertEqual(resp_patch.status_code, 200)
        camp.refresh_from_db()
        self.assertEqual(camp.name, "Updated Campaign Title")
        self.assertEqual(camp.calls_per_second, 4)
        self.assertEqual(camp.max_retries, 3)

        # 3. Add raw contacts to the campaign
        resp_add = client.post(f"/api/v1/campaigns/{camp.id}/add_contacts/", {
            "raw_contacts": [
                {"name": "Ananya Direct", "phone_number": "+919876543211", "company": "Direct Corp"},
                {"name": "Rajesh Direct", "phone_number": "9123456780"},
            ]
        }, format="json")
        self.assertEqual(resp_add.status_code, 200)
        self.assertEqual(resp_add.json()["added_count"], 2)

        camp.refresh_from_db()
        self.assertEqual(camp.total_contacts, 2)
        self.assertGreater(camp.estimated_cost_inr, 0)
