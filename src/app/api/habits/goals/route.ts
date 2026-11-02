import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireApiUser } from "@/lib/api";
import { habitTrackerEnabled } from "@/lib/reset/flags";
import { logGoalProgress } from "@/lib/reset/habits";
import { formatZodError } from "@/lib/validation";

export const dynamic = "force-dynamic";

const schema = z.object({
  goalId: z.string().min(1),
  value: z.number().gte(0).max(1_000_000),
  note: z.string().max(500).optional(),
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function POST(request: Request) {
  if (!habitTrackerEnabled()) return jsonError("Habit Tracker is disabled.", 404);
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(formatZodError(parsed.error));

  const result = await logGoalProgress(
    auth.ctx.user,
    parsed.data.goalId,
    parsed.data.value,
    parsed.data.note ?? "",
    parsed.data.dateKey,
  );
  if (!result.ok) return jsonError(result.message);
  return NextResponse.json(result);
}
