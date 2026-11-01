import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser, jsonError } from "@/lib/api";
import { formatZodError, updateDomainSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const { slug } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateDomainSchema.safeParse(body);
  if (!parsed.success) return jsonError(formatZodError(parsed.error));

  const domain = await prisma.domain.findFirst({ where: { userId: auth.ctx.userId, slug } });
  if (!domain) return jsonError("Domain not found.", 404);

  const updated = await prisma.domain.update({
    where: { id: domain.id },
    data: {
      ...(parsed.data.goals !== undefined ? { goals: parsed.data.goals } : {}),
      ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
      ...(parsed.data.isProtected !== undefined ? { isProtected: parsed.data.isProtected } : {}),
      ...(parsed.data.isEnabled !== undefined ? { isEnabled: parsed.data.isEnabled } : {}),
    },
  });

  return NextResponse.json({ ok: true, domain: { slug: updated.slug } });
}
