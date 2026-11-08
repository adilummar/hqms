import { NextResponse } from "next/server";
import { processStaffSessionAbsences } from "@/lib/services/staff-attendance-data";

export const dynamic = "force-dynamic";

/**
 * Automatic FN/AN absence processor.
 *
 * Triggered at 14:00 IST (08:30 UTC) and 23:00 IST (17:30 UTC) by Supabase
 * pg_cron (see scripts/supabase-staff-session-cron.sql), and once a day by the
 * Vercel cron as a catch-up sweep. Safe to call any number of times.
 *
 * Optional `?days=N` (1–31) widens the lookback for a manual backfill.
 */
async function handle(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // FAIL CLOSED: missing secret or mismatch → reject.
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const daysParam = parseInt(new URL(request.url).searchParams.get("days") ?? "", 10);
  const lookbackDays = Number.isFinite(daysParam) ? Math.min(Math.max(daysParam, 1), 31) : 2;

  try {
    const result = await processStaffSessionAbsences(new Date(), lookbackDays);
    console.log("[cron:staff-session-absent]", JSON.stringify(result));
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Failed to run staff session absence cron:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
