export interface Organization {
  id: number;
  name: string;
  slug: string;
  timezone: string;
  compliance_mode: boolean;
  max_daily_budget_inr: string;
  created_at: string;
}

export interface VoiceAgent {
  id: number;
  organization: number;
  name: string;
  purpose: string;
  purpose_display: string;
  sarvam_app_id: string;
  sarvam_app_version: number;
  primary_language: string;
  language_display: string;
  voice_model: string;
  speaker: string;
  turn_timeout_seconds: number;
  max_conversation_duration_seconds: number;
  greeting_message: string;
  system_instructions: string;
  knowledge_files?: any[];
  is_active: boolean;
  created_at: string;
}

export interface Contact {
  id: number;
  organization: number;
  name: string;
  phone_number: string;
  company: string;
  email: string;
  custom_fields: Record<string, any>;
  has_consent: boolean;
  is_opted_out: boolean;
  notes: string;
  created_at: string;
}

export interface SuppressionEntry {
  id: number;
  phone_number: string;
  reason: string;
  reason_display: string;
  notes: string;
  created_at: string;
}

export interface Campaign {
  id: number;
  organization: number;
  name: string;
  description: string;
  agent: number;
  agent_details?: VoiceAgent;
  status: "draft" | "scheduled" | "running" | "paused" | "completed" | "cancelled";
  status_display: string;
  calling_window_start: string;
  calling_window_end: string;
  calls_per_second: number;
  max_retries: number;
  is_confirmed: boolean;
  estimated_cost_inr: string;
  actual_cost_inr: string;
  total_contacts: number;
  calls_attempted: number;
  calls_answered: number;
  calls_completed: number;
  calls_failed: number;
  contacts_count?: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface CallAttempt {
  id: number;
  internal_uuid: string;
  sarvam_attempt_id: string;
  interaction_id: string;
  contact?: number;
  contact_name: string;
  agent?: number;
  agent_name: string;
  campaign?: number;
  campaign_name: string;
  user_phone_number: string;
  masked_phone_number: string;
  agent_phone_number: string;
  status: "initiated" | "connected" | "no_answer" | "busy" | "failed";
  status_display: string;
  duration_seconds: number;
  cost_inr: string;
  failure_reason: string;
  is_mock: boolean;
  transcript?: Transcript;
  created_at: string;
}

export interface TranscriptMessage {
  turn_id: number;
  role: "assistant" | "user";
  content: string;
  language_name: string;
}

export interface Transcript {
  id: number;
  call_attempt: number;
  messages: TranscriptMessage[];
  summary: string;
  disposition: string;
  sentiment: string;
  created_at: string;
}

export interface Meeting {
  id: number;
  contact: number;
  contact_details?: Contact;
  call_attempt?: number;
  title: string;
  scheduled_time: string;
  timezone: string;
  status: "requested" | "confirmed" | "completed" | "cancelled";
  status_display: string;
  notes: string;
  created_at: string;
}

export interface DashboardMetrics {
  total_contacts: number;
  total_campaigns: number;
  total_agents: number;
  calls_attempted: number;
  calls_answered: number;
  calls_completed: number;
  calls_failed: number;
  calls_pending: number;
  pickup_rate_pct: number;
  total_minutes: number;
  avg_duration_seconds: number;
  total_cost_inr: number;
  cost_unit: string;
}

export interface ProviderStatus {
  configured: boolean;
  provider: string;
  is_mock: boolean;
  connection_id_configured: boolean;
  agent_phone_number_configured: boolean;
  rented_number: string;
  message?: string;
}
