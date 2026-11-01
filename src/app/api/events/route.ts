import { NextResponse } from "next/server";
import { requireApiUser, jsonError } from "@/lib/api";
import { createEvent, listEvents } from "@/lib/calendar/service";
import { toUiConflicts, toUiEvent } from "@/lib/dto";
import { createEventSchema, eventRangeSchema, formatZodError } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  const parsed = eventRangeSchema.safeParse({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    domain: url.searchParams.get("domain") ?? undefined,
  });

  if (!parsed.success) return jsonError(formatZodError(parsed.error));

  const events = await listEvents(auth.ctx.user, {
    from: parsed.data.from,
    to: parsed.data.to,
    domainSlug: parsed.data.domain,
    includeSuggested: url.searchParams.get("includeSuggested") !== "false",
  });

  return NextResponse.json({ events: events.map(toUiEvent) });
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = createEventSchema.safeParse(body);
  if (!parsed.success) return jsonError(formatZodError(parsed.error));

  const result = await createEvent(auth.ctx.user, {
    ...parsed.data,
    source: "manual",
  });

  return NextResponse.json({
    ok: result.ok,
    event: result.event ? toUiEvent(result.event) : null,
    conflicts: toUiConflicts(result.conflicts),
    requiresConfirmation: result.requiresConfirmation,
    message: result.message ?? null,
  });
}
