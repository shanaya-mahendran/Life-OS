import { NextResponse } from "next/server";
import { jsonError, requireApiUser } from "@/lib/api";
import { acceptMainTaskSchedule, proposeMainTaskSchedule } from "@/lib/tasks/service";
import { formatZodError, taskScheduleSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = taskScheduleSchema.safeParse(body);
  if (!parsed.success) return jsonError(formatZodError(parsed.error));
  const { id } = await params;

  if (parsed.data.action === "propose") {
    const result = await proposeMainTaskSchedule(auth.ctx.user, id);
    if (!result.ok) return jsonError(result.message, result.message === "Task not found." ? 404 : 409);
    return NextResponse.json({
      ok: true,
      proposals: result.proposals.map((proposal) => ({
        ...proposal,
        start: proposal.start.toISOString(),
        end: proposal.end.toISOString(),
      })),
      unscheduledCount: result.unscheduledCount,
    });
  }

  const result = await acceptMainTaskSchedule(auth.ctx.user, id, parsed.data.assignments);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.message, scheduledCount: result.scheduledCount },
      { status: result.message === "Task not found." ? 404 : 409 },
    );
  }
  return NextResponse.json({ ok: true, scheduledCount: result.scheduledCount });
}
