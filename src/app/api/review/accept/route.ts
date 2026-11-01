import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser, jsonError } from "@/lib/api";
import { createEvent } from "@/lib/calendar/service";
import { toUiEvent } from "@/lib/dto";
import { formatZodError } from "@/lib/validation";

export const dynamic = "force-dynamic";

const schema = z.object({
  blocks: z
    .array(
      z.object({
        domainSlug: z.string().min(1),
        title: z.string().trim().min(1).max(160),
        startISO: z.string().min(10),
        endISO: z.string().min(10),
      }),
    )
    .min(1)
    .max(12),
});

/** Accept the review's proposals → dashed "suggested" blocks on the calendar. */
export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(formatZodError(parsed.error));

  const created = [];
  for (const block of parsed.data.blocks) {
    const result = await createEvent(auth.ctx.user, {
      domainSlug: block.domainSlug,
      title: block.title,
      start: new Date(block.startISO),
      end: new Date(block.endISO),
      status: "suggested",
      source: "auto",
      force: true,
    });
    if (result.ok && result.event) created.push(toUiEvent(result.event));
  }

  return NextResponse.json({ ok: true, created });
}
