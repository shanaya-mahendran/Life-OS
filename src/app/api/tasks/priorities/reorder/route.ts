import { NextResponse } from "next/server";
import { jsonError, requireApiUser } from "@/lib/api";
import { reorderPriorityTasks } from "@/lib/tasks/service";
import { formatZodError, priorityReorderSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const body = await request.json().catch(() => null);
  const parsed = priorityReorderSchema.safeParse(body);
  if (!parsed.success) return jsonError(formatZodError(parsed.error));
  const result = await reorderPriorityTasks(auth.ctx.userId, parsed.data.ids);
  if (!result.ok) return jsonError(result.message, 400);
  return NextResponse.json({ ok: true });
}
