import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/sarvam-orchestrator";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ job_id: string }> }
) {
  const { job_id } = await params;
  const job = getJob(job_id);

  if (!job) {
    return NextResponse.json(
      { error: `CallJob '${job_id}' not found` },
      { status: 404 }
    );
  }

  return NextResponse.json(job);
}
