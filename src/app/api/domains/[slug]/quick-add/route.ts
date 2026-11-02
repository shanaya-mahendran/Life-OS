import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireApiUser } from "@/lib/api";
import { createEvent, findSlots } from "@/lib/calendar/service";
import { toUiEvent } from "@/lib/dto";
import { addZonedDays, formatInZone } from "@/lib/time";
import { formatZodError } from "@/lib/validation";

export const dynamic = "force-dynamic";

const schema = z.object({
  title: z.string().trim().min(1).max(160),
  minutes: z.number().int().min(15).max(480).optional(),
  description: z.string().max(500).optional(),
});

/**
 * Book a domain template ("Karate training", "Study block") into the next free
 * slot. Uses the same conflict-aware calendar service as chat and the UI.
 */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const { slug } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(formatZodError(parsed.error));

  const minutes = parsed.data.minutes ?? 60;
  const now = new Date();
  const to = addZonedDays(now, 10, auth.ctx.user.timezone);

  const slots = await findSlots(auth.ctx.user, { from: now, to, durationMinutes: minutes, maxSlots: 1 });
  const slot = slots[0];
  if (!slot) {
    return jsonError("No free slot in the next ten days. Free something up first.", 409);
  }

  const result = await createEvent(auth.ctx.user, {
    domainSlug: slug,
    title: parsed.data.title,
    start: slot.start,
    end: slot.end,
    description: parsed.data.description ?? "",
    source: "manual",
    force: true,
  });

  if (!result.ok || !result.event) {
    const reason = result.conflicts?.map((c) => c.message).join(", ") || result.message || "Could not add that block.";
    return jsonError(reason, 400);
  }

  return NextResponse.json({
    ok: true,
    event: toUiEvent(result.event),
    label: `${formatInZone(result.event.start, auth.ctx.user.timezone, {
      weekday: "short",
      day: "numeric",
      month: "short",
    })} · ${formatInZone(result.event.start, auth.ctx.user.timezone, { hour: "numeric", minute: "2-digit" })}`,
  });
}
