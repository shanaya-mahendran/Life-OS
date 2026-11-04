import { z } from "zod";

const dateInput = z.coerce.date();

export const eventRangeSchema = z.object({
  from: dateInput,
  to: dateInput,
  domain: z.string().optional(),
});

export const createEventSchema = z.object({
  domainSlug: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  start: dateInput,
  end: dateInput.optional(),
  minutes: z.number().int().min(5).max(2880).optional(),
  description: z.string().max(4000).optional(),
  location: z.string().max(200).optional(),
  priority: z.number().int().min(0).max(3).optional(),
  recurrence: z.string().max(80).nullable().optional(),
  status: z.enum(["planned", "suggested"]).optional(),
  force: z.boolean().optional(),
});

export const updateEventSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  start: dateInput.optional(),
  end: dateInput.optional(),
  minutes: z.number().int().min(5).max(2880).optional(),
  description: z.string().max(4000).optional(),
  location: z.string().max(200).optional(),
  priority: z.number().int().min(0).max(3).optional(),
  status: z.enum(["planned", "suggested", "done", "cancelled"]).optional(),
  domainSlug: z.string().min(1).optional(),
  recurrence: z.string().max(80).nullable().optional(),
  force: z.boolean().optional(),
});

export const createTaskSchema = z.object({
  domainSlug: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  dueDate: dateInput.nullable().optional(),
  deadline: dateInput.nullable().optional(),
  estimateMinutes: z.number().int().min(5).max(600).optional(),
  priority: z.number().int().min(0).max(3).optional(),
  isPriority: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
  subtasks: z.array(z.object({
    title: z.string().trim().min(1).max(120),
    notes: z.string().max(2000).optional(),
    durationMin: z.number().int().min(5).max(720).multipleOf(5),
    scheduledStart: dateInput.nullable().optional(),
  })).max(50).optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  status: z.enum(["todo", "doing", "done", "slipped"]).optional(),
  dueDate: dateInput.nullable().optional(),
  deadline: dateInput.nullable().optional(),
  priority: z.number().int().min(0).max(3).optional(),
  domainSlug: z.string().min(1).optional(),
  isPriority: z.boolean().optional(),
  priorityRank: z.number().int().min(0).nullable().optional(),
  notes: z.string().max(2000).optional(),
});

export const subtaskSchema = z.object({
  title: z.string().trim().min(1).max(120),
  notes: z.string().max(2000).optional(),
  durationMin: z.number().int().min(5).max(720).multipleOf(5),
  scheduledStart: dateInput.nullable().optional(),
  status: z.enum(["todo", "doing", "done"]).optional(),
  force: z.boolean().optional(),
});

export const subtaskReorderSchema = z.object({
  taskId: z.string().min(1),
  ids: z.array(z.string().min(1)).max(100),
});

export const priorityReorderSchema = z.object({
  ids: z.array(z.string().min(1)).max(500),
});

export const taskScheduleSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("propose") }),
  z.object({
    action: z.literal("accept"),
    assignments: z.array(z.object({
      subtaskId: z.string().min(1),
      start: dateInput,
    })).min(1).max(50),
  }),
]);

export const chatSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      }),
    )
    .max(20)
    .optional(),
});

export const updateDomainSchema = z.object({
  goals: z.array(z.string().max(200)).max(20).optional(),
  notes: z.string().max(4000).optional(),
  isProtected: z.boolean().optional(),
  isEnabled: z.boolean().optional(),
});

export function formatZodError(error: z.ZodError): string {
  const first = error.issues[0];
  if (!first) return "Invalid request.";
  const path = first.path.join(".");
  return path ? `${path}: ${first.message}` : first.message;
}
