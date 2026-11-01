import { NextResponse } from "next/server";
import { requireApiUser, jsonError } from "@/lib/api";
import { cancelEvent, updateEvent } from "@/lib/calendar/service";
import { toUiConflicts, toUiEvent } from "@/lib/dto";
import { formatZodError, updateEventSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateEventSchema.safeParse(body);
  if (!parsed.success) return jsonError(formatZodError(parsed.error));

  const result = await updateEvent(auth.ctx.user, id, parsed.data);

  return NextResponse.json({
    ok: result.ok,
    event: result.event ? toUiEvent(result.event) : null,
    conflicts: toUiConflicts(result.conflicts),
    requiresConfirmation: result.requiresConfirmation,
    message: result.message ?? null,
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const result = await cancelEvent(auth.ctx.user, id);

  if (!result.ok) return jsonError(result.message ?? "Could not cancel the event.", 404);

  return NextResponse.json({ ok: true, event: result.event ? toUiEvent(result.event) : null });
}
