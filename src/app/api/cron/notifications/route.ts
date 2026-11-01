import { NextResponse } from "next/server";
import { generateEventNotifications } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorised(request: Request): boolean {
  // Allow running locally in dev mode or with query param ?secret=
  if (process.env.NODE_ENV !== "production") return true;

  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const url = new URL(request.url);
  if (url.searchParams.get("secret") === secret) return true;

  const header = request.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : header;
  return bearer === secret;
}

/**
 * Vercel Cron → GET /api/cron/notifications
 * Runs periodically to generate:
 * - 30 minutes before event reminders
 * - 15 minutes before event reminders
 * - 15 minutes after event plan achievement check-ins
 */
export async function GET(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  try {
    const result = await generateEventNotifications();
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error("[lifeos] notification cron error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Notification cron failed" },
      { status: 500 },
    );
  }
}
