import { NextResponse } from "next/server";
import { requireApiUser, jsonError } from "@/lib/api";
import { getEvent, previewConflicts } from "@/lib/calendar/service";
import { toUiConflicts } from "@/lib/dto";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const event = await getEvent(auth.ctx.user, id);
  if (!event) return jsonError("Event not found.", 404);

  const conflicts = await previewConflicts(auth.ctx.user, {
    id: event.id,
    title: event.title,
    start: event.start,
    end: event.end,
    domainSlug: event.domainSlug,
  });

  return NextResponse.json({ conflicts: toUiConflicts(conflicts) });
}
