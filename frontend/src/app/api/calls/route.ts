import { NextRequest, NextResponse } from "next/server";
import {
  createCallJob,
  placeCall,
  listJobs,
} from "@/lib/sarvam-orchestrator";

export async function GET() {
  const jobs = listJobs();
  return NextResponse.json(jobs);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.phone || typeof body.phone !== "string") {
      return NextResponse.json(
        { error: "Field 'phone' is required and must be an E.164 formatted string (e.g. +919876543210)" },
        { status: 400 }
      );
    }

    const { job, block } = createCallJob({
      phone: body.phone,
      app_id: body.app_id,
      app_version: body.app_version ? Number(body.app_version) : undefined,
      variables: body.variables || {},
      opening_line: body.opening_line,
      bypass_window: Boolean(body.bypass_window),
    });

    if (block) {
      return NextResponse.json(
        {
          job_id: job.job_id,
          state: job.state,
          reason: block,
          phone: job.phone,
          history: job.history,
        },
        { status: 200 }
      );
    }

    // Place the outbound call asynchronously
    await placeCall(job);

    return NextResponse.json(
      {
        job_id: job.job_id,
        state: job.state,
        attempt_id: job.attempt_id,
        history: job.history,
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to process call request" },
      { status: 500 }
    );
  }
}
