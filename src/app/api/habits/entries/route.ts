import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireApiUser } from "@/lib/api";
import { habitTrackerEnabled } from "@/lib/reset/flags";
import { setHabitEntry } from "@/lib/reset/habits";
import { formatZodError } from "@/lib/validation";

export const dynamic = "force-dynamic";

const schema = z.object({
  habitId: z.string().min(1),
  result: z.enum(["done", "skipped", "missed"]),
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function POST(request: Request) {
  if (!habitTrackerEnabled()) return jsonError("Habit Tracker is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(formatZodError(parsed.error));

  const result = await setHabitEntry(
    auth.ctx.user,
    parsed.data.habitId,
    parsed.data.result,
    parsed.data.dateKey,
  );
  if (!result.ok) return jsonError(result.message);
  return NextResponse.json(result);
}
