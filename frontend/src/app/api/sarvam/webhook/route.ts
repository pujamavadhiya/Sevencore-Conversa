import { NextRequest, NextResponse } from "next/server";
import { getSarvamConfig, handleWebhookPayload } from "@/lib/sarvam-orchestrator";

export async function POST(req: NextRequest) {
  const cfg = getSarvamConfig();

  if (cfg.WEBHOOK_SECRET) {
    const headerSecret = req.headers.get("x-webhook-secret");
    const querySecret = req.nextUrl.searchParams.get("secret");
    if (headerSecret !== cfg.WEBHOOK_SECRET && querySecret !== cfg.WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: "Unauthorized: invalid webhook secret" },
        { status: 401 }
      );
    }
  }

  try {
    const payload = await req.json();
    const result = handleWebhookPayload(payload);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Malformed JSON payload" },
      { status: 400 }
    );
  }
}
