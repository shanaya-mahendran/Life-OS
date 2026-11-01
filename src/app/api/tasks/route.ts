import { NextResponse } from "next/server";
import { requireApiUser, jsonError } from "@/lib/api";
import { createTask, listTasks } from "@/lib/calendar/service";
import { toUiTask } from "@/lib/dto";
import { createTaskSchema, formatZodError } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  const tasks = await listTasks(auth.ctx.user, {
    domainSlug: url.searchParams.get("domain") ?? undefined,
    includeDone: url.searchParams.get("includeDone") === "true",
  });

  return NextResponse.json({ tasks: tasks.map(toUiTask) });
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) return jsonError(formatZodError(parsed.error));

  const result = await createTask(auth.ctx.user, parsed.data);
  if (!result.ok) return jsonError(result.message, 400);

  return NextResponse.json({ ok: true, task: toUiTask(result.task) });
}
