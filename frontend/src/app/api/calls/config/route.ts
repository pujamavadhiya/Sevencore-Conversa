import { NextResponse } from "next/server";
import { getSarvamConfig } from "@/lib/sarvam-orchestrator";

export async function GET() {
  const cfg = getSarvamConfig();

  return NextResponse.json({
    api_base: cfg.API_BASE,
    api_key_configured: Boolean(cfg.API_KEY),
    api_key_masked:
      cfg.API_KEY.length >= 8
        ? `${cfg.API_KEY.slice(0, 4)}...${cfg.API_KEY.slice(-4)}`
        : "***",
    org_id: cfg.ORG_ID,
    workspace_id: cfg.WORKSPACE_ID,
    connection_id: cfg.CONNECTION_ID,
    caller_number: cfg.CALLER_NUMBER,
    webhook_url: cfg.WEBHOOK_URL,
    webhook_secret_configured: Boolean(cfg.WEBHOOK_SECRET),
    default_app_id: cfg.DEFAULT_APP_ID,
    default_app_version: cfg.DEFAULT_APP_VERSION,
    calling_window_hours: `${String(cfg.CALLING_WINDOW_START_HOUR).padStart(2, "0")}:00 - ${String(cfg.CALLING_WINDOW_END_HOUR).padStart(2, "0")}:00`,
    timezone: cfg.TIME_ZONE,
    max_attempts: cfg.MAX_ATTEMPTS,
    retry_delays_sec: cfg.RETRY_DELAYS_SEC,
  });
}
