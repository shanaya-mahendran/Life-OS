import { NextResponse } from "next/server";
import { requireApiUser, jsonError } from "@/lib/api";
import { createTask, listTasks } from "@/lib/calendar/service";
import { createMainTask, listMainTasks } from "@/lib/tasks/service";
import { prisma } from "@/lib/db";
import { toUiTask } from "@/lib/dto";
import { createTaskSchema, formatZodError } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  if (url.searchParams.get("include") === "subtasks" || url.searchParams.get("priority") === "true") {
    const tasks = await listMainTasks(auth.ctx.user, {
      domainSlug: url.searchParams.get("domain") ?? undefined,
      priority: url.searchParams.get("priority") === "true",
      includeDone: url.searchParams.get("includeDone") === "true",
    });
    return NextResponse.json({ tasks });
  }
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

  if (parsed.data.deadline !== undefined || parsed.data.isPriority !== undefined || parsed.data.subtasks !== undefined) {
    const result = await createMainTask(auth.ctx.user, {
      domainSlug: parsed.data.domainSlug,
      title: parsed.data.title,
      notes: parsed.data.notes,
      deadline: parsed.data.deadline ?? parsed.data.dueDate,
      isPriority: parsed.data.isPriority ?? (parsed.data.priority ?? 1) >= 2,
      subtasks: parsed.data.subtasks,
    });
    if (!result.ok) return jsonError(result.message, 400);
    const activePriorities = await prisma.task.count({
      where: {
        userId: auth.ctx.userId,
        status: { not: "done" },
        OR: [{ isPriority: true }, { priority: { gte: 2 } }],
      },
    });
    return NextResponse.json(
      {
        ok: true,
        task: result.task,
        ...(parsed.data.isPriority && activePriorities > 5 ? { warning: "You have 5 priorities already." } : {}),
      },
      { status: 201 },
    );
  }

  const result = await createTask(auth.ctx.user, parsed.data);
  if (!result.ok) return jsonError(result.message, 400);

  return NextResponse.json({ ok: true, task: toUiTask(result.task) });
}
