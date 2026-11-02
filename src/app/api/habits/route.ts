import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireApiUser } from "@/lib/api";
import { habitTrackerEnabled } from "@/lib/reset/flags";
import { archiveHabit, createManualHabit, getHabitOverview } from "@/lib/reset/habits";
import { formatZodError } from "@/lib/validation";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  title: z.string().trim().min(1).max(160),
  notes: z.string().max(1000).optional(),
  domainSlug: z.string().max(60).optional(),
  cadence: z.enum(["daily", "weekly"]).optional(),
  weekday: z.number().int().min(0).max(6).nullable().optional(),
});

export async function GET() {
  if (!habitTrackerEnabled()) return jsonError("Habit Tracker is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const overview = await getHabitOverview(auth.ctx.user);
  return NextResponse.json({ ok: true, ...overview });
}

export async function POST(request: Request) {
  if (!habitTrackerEnabled()) return jsonError("Habit Tracker is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return jsonError(formatZodError(parsed.error));

  const result = await createManualHabit(auth.ctx.user, parsed.data);
  if (!result.ok) return jsonError(result.message);
  return NextResponse.json(result);
}

export async function DELETE(request: Request) {
  if (!habitTrackerEnabled()) return jsonError("Habit Tracker is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  const habitId = url.searchParams.get("id");
  if (!habitId) return jsonError("Missing habit id.");

  const result = await archiveHabit(auth.ctx.userId, habitId);
  if (!result.ok) return jsonError(result.message);
  return NextResponse.json(result);
}
