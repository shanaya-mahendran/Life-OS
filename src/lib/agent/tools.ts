/**
 * Typed agent tools.
 *
 * The model can only change the world through these functions. Each one wraps
 * the calendar service, so validation, conflict checks, protected-time rules
 * and undo records are identical to the ones used by the UI.
 */

import { z } from "zod";
import { DOMAINS, DOMAIN_MAP } from "@/lib/domains/catalog";
import {
  cancelEvent,
  createEvent,
  createTask,
  findSlots,
  listEvents,
  listTasks,
  updateEvent,
  updateTask,
  type InverseOp,
  type ServiceUser,
} from "@/lib/calendar/service";
import { addZonedDays, startOfZonedDay, utcToZoned, zonedToUtc } from "@/lib/time";
import { saveMemory, recallMemories } from "./memory";

export interface AgentContext {
  userId: string;
  user: ServiceUser;
  now: Date;
}

export interface ChangeSummary {
  kind: "event" | "task";
  action: "created" | "moved" | "cancelled" | "completed" | "suggested";
  title: string;
  domainSlug: string;
  domainName: string;
  domainAccent: string;
  start?: string;
  end?: string;
}

export interface ToolOutcome {
  data: Record<string, unknown>;
  inverse?: InverseOp[];
  change?: ChangeSummary;
  /** Multi-block writes (plan_backwards) report every block they created. */
  changes?: ChangeSummary[];
}

export interface AgentTool {
  name: string;
  description: string;
  schema: z.ZodObject<z.ZodRawShape>;
  handler: (args: Record<string, unknown>, ctx: AgentContext) => Promise<ToolOutcome>;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

const ISO_WITH_ZONE = /(Z|[+-]\d{2}:?\d{2})$/;

/** Accept absolute ISO timestamps as well as "YYYY-MM-DD HH:mm" in the user's zone. */
export function parseWhen(value: string, timeZone: string): Date | null {
  const text = value.trim();
  if (!text) return null;

  if (ISO_WITH_ZONE.test(text) && !/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const match = text.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{1,2}):(\d{2})(?::\d{2})?)?$/,
  );
  if (match) {
    const [, year, month, day, hour, minute] = match;
    return zonedToUtc(
      {
        year: Number(year),
        month: Number(month),
        day: Number(day),
        hour: hour ? Number(hour) : 9,
        minute: minute ? Number(minute) : 0,
      },
      timeZone,
    );
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isoLocal(date: Date, timeZone: string): string {
  const local = utcToZoned(date, timeZone);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${local.year}-${pad(local.month)}-${pad(local.day)} ${pad(local.hour)}:${pad(local.minute)}`;
}

export function resolveDomainSlug(input: string): string | null {
  const needle = input.trim().toLowerCase();
  if (!needle) return null;
  if (DOMAIN_MAP[needle]) return needle;

  const normalised = needle.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (DOMAIN_MAP[normalised]) return normalised;

  const byName = DOMAINS.find(
    (domain) =>
      domain.name.toLowerCase() === needle ||
      domain.shortName.toLowerCase() === needle ||
      domain.name.toLowerCase().includes(needle) ||
      needle.includes(domain.slug.replace("-", " ")),
  );
  return byName?.slug ?? null;
}

async function findTargetEvent(ctx: AgentContext, args: { eventId?: unknown; title?: unknown }) {
  const events = await listEvents(ctx.user, {
    from: addZonedDays(ctx.now, -2, ctx.user.timezone),
    to: addZonedDays(ctx.now, 60, ctx.user.timezone),
    includeSuggested: true,
  });

  const eventId = typeof args.eventId === "string" ? args.eventId : undefined;
  if (eventId) {
    const exact = events.find((event) => event.id === eventId);
    if (exact) return exact;
  }

  const title = typeof args.title === "string" ? args.title.toLowerCase().trim() : "";
  if (!title) return null;

  const scored = events
    .map((event) => {
      const haystack = `${event.title} ${event.domainName}`.toLowerCase();
      const words = title.split(/\s+/).filter((word) => word.length > 2);
      const score = words.reduce((total, word) => (haystack.includes(word) ? total + 1 : total), 0);
      return { event, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.event.start.getTime() - b.event.start.getTime());

  return scored[0]?.event ?? null;
}

function summarise(event: {
  title: string;
  domainSlug: string;
  domainName: string;
  domainAccent: string;
  start: Date;
  end: Date;
}): Pick<ChangeSummary, "title" | "domainSlug" | "domainName" | "domainAccent" | "start" | "end"> {
  return {
    title: event.title,
    domainSlug: event.domainSlug,
    domainName: event.domainName,
    domainAccent: event.domainAccent,
    start: event.start.toISOString(),
    end: event.end.toISOString(),
  };
}

/* -------------------------------------------------------------------------- */
/* Tool definitions                                                            */
/* -------------------------------------------------------------------------- */

export const TOOLS: AgentTool[] = [
  {
    name: "query_schedule",
    description:
      "Read the user's calendar for a date range. Always use this before moving or cancelling so you target the right event.",
    schema: z.object({
      from: z.string().describe("Start of the range, e.g. 2026-11-02 00:00 (user timezone) or ISO 8601."),
      to: z.string().describe("End of the range, exclusive."),
      domain: z.string().optional().describe("Optional domain slug such as education or karate."),
    }),
    async handler(args, ctx) {
      const from = parseWhen(String(args.from ?? ""), ctx.user.timezone);
      const to = parseWhen(String(args.to ?? ""), ctx.user.timezone);
      if (!from || !to) return { data: { error: "Could not understand the date range." } };

      const domainSlug =
        typeof args.domain === "string" ? resolveDomainSlug(args.domain) ?? undefined : undefined;
      const events = await listEvents(ctx.user, {
        from,
        to,
        domainSlug,
        includeSuggested: true,
      });

      return {
        data: {
          timezone: ctx.user.timezone,
          events: events.slice(0, 80).map((event) => ({
            id: event.id,
            title: event.title,
            domain: event.domainSlug,
            start: isoLocal(event.start, ctx.user.timezone),
            end: isoLocal(event.end, ctx.user.timezone),
            status: event.status,
            protected: event.isProtected,
            recurring: Boolean(event.recurrence),
          })),
        },
      };
    },
  },

  {
    name: "create_event",
    description:
      "Create a calendar event in a domain. Returns needsConfirmation when the slot conflicts or eats protected time — never claim it was saved in that case.",
    schema: z.object({
      domain: z.string().describe("Domain slug, e.g. education, karate, competitions, sleep."),
      title: z.string().describe("Short event title."),
      start: z.string().describe("Start time as 2026-11-03 19:00 in the user's timezone."),
      minutes: z.number().optional().describe("Duration in minutes (default 60)."),
      end: z.string().optional().describe("Explicit end time; overrides minutes."),
      description: z.string().optional(),
      recurrence: z
        .string()
        .optional()
        .describe("Optional repeat rule: DAILY, WEEKLY or WEEKLY:MO,WE,FR."),
      force: z.boolean().optional().describe("Set true to force create despite non-blocking warnings."),
    }),
    async handler(args, ctx) {
      const domainSlug = resolveDomainSlug(String(args.domain ?? ""));
      if (!domainSlug) {
        return { data: { error: `Unknown domain. Valid domains: ${DOMAINS.map((d) => d.slug).join(", ")}.` } };
      }
      const start = parseWhen(String(args.start ?? ""), ctx.user.timezone);
      if (!start) return { data: { error: "Could not understand the start time." } };

      const end = typeof args.end === "string" ? parseWhen(args.end, ctx.user.timezone) ?? undefined : undefined;
      let minutes = typeof args.minutes === "number" ? Math.round(args.minutes) : undefined;
      if (!minutes && end) {
        minutes = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60_000));
      }

      const result = await createEvent(ctx.user, {
        domainSlug,
        title: String(args.title ?? "Untitled block").slice(0, 160),
        start,
        end,
        minutes: minutes ?? 60,
        description: typeof args.description === "string" ? args.description : "",
        recurrence: typeof args.recurrence === "string" && args.recurrence ? args.recurrence : null,
        source: "agent",
        force: Boolean(args.force),
      });

      if (!result.ok) {
        return {
          data: {
            saved: false,
            needsConfirmation: result.requiresConfirmation,
            conflicts: result.conflicts.map((conflict) => conflict.message),
            proposed: {
              domain: domainSlug,
              title: args.title,
              start: isoLocal(start, ctx.user.timezone),
              minutes: minutes ?? 60,
            },
            instruction: result.requiresConfirmation
              ? "Do not save. Tell the user about the conflict and ask whether to save anyway."
              : result.message,
          },
        };
      }

      const event = result.event!;
      return {
        data: {
          saved: true,
          event: {
            id: event.id,
            title: event.title,
            domain: event.domainSlug,
            start: isoLocal(event.start, ctx.user.timezone),
            end: isoLocal(event.end, ctx.user.timezone),
          },
        },
        inverse: result.inverse ? [result.inverse] : undefined,
        change: { kind: "event", action: "created", ...summarise(event) },
      };
    },
  },

  {
    name: "move_event",
    description: "Move or resize an existing event. Find it with query_schedule first when unsure.",
    schema: z.object({
      eventId: z.string().optional().describe("Exact event id from query_schedule."),
      title: z.string().optional().describe("Part of the event title, e.g. karate."),
      when: z.string().describe("New start as 2026-11-03 19:00 in the user's timezone."),
      minutes: z.number().optional().describe("New duration in minutes; keeps the old duration when omitted."),
      force: z.boolean().optional().describe("Only true after the user explicitly confirmed a conflict."),
    }),
    async handler(args, ctx) {
      const target = await findTargetEvent(ctx, args);
      if (!target) {
        return { data: { error: "I could not find that event. Try query_schedule to list what is on." } };
      }
      const when = parseWhen(String(args.when ?? ""), ctx.user.timezone);
      if (!when) return { data: { error: "Could not understand the new time." } };

      const minutes =
        typeof args.minutes === "number"
          ? Math.round(args.minutes)
          : Math.round((target.end.getTime() - target.start.getTime()) / 60_000);

      const result = await updateEvent(ctx.user, target.id, {
        start: when,
        minutes,
        force: args.force === true,
      });

      if (!result.ok) {
        return {
          data: {
            saved: false,
            needsConfirmation: result.requiresConfirmation,
            conflicts: result.conflicts.map((conflict) => conflict.message),
            event: { id: target.id, title: target.title },
            proposed: { start: isoLocal(when, ctx.user.timezone), minutes },
            instruction: result.requiresConfirmation
              ? "Do not save. Explain the conflict and ask the user to confirm."
              : result.message,
          },
        };
      }

      const event = result.event!;
      return {
        data: {
          saved: true,
          event: {
            id: event.id,
            title: event.title,
            domain: event.domainSlug,
            start: isoLocal(event.start, ctx.user.timezone),
            end: isoLocal(event.end, ctx.user.timezone),
          },
          previousStart: isoLocal(target.start, ctx.user.timezone),
        },
        inverse: result.inverse ? [result.inverse] : undefined,
        change: { kind: "event", action: "moved", ...summarise(event) },
      };
    },
  },

  {
    name: "cancel_event",
    description: "Cancel an event. Protected events need explicit confirmation.",
    schema: z.object({
      eventId: z.string().optional(),
      title: z.string().optional().describe("Part of the event title."),
      force: z.boolean().optional(),
    }),
    async handler(args, ctx) {
      const target = await findTargetEvent(ctx, args);
      if (!target) return { data: { error: "I could not find that event." } };

      if (target.isProtected && args.force !== true) {
        return {
          data: {
            saved: false,
            needsConfirmation: true,
            conflicts: [`${target.title} belongs to ${target.domainName}, which is protected time.`],
            event: { id: target.id, title: target.title },
            instruction: "Do not cancel. Ask the user to confirm cancelling protected time.",
          },
        };
      }

      const result = await cancelEvent(ctx.user, target.id);
      if (!result.ok) return { data: { error: result.message ?? "Could not cancel the event." } };

      return {
        data: { saved: true, cancelled: target.title, start: isoLocal(target.start, ctx.user.timezone) },
        inverse: result.inverse ? [result.inverse] : undefined,
        change: { kind: "event", action: "cancelled", ...summarise(target) },
      };
    },
  },

  {
    name: "find_free_slots",
    description: "Find open slots that respect protected time, sleeping hours and existing events.",
    schema: z.object({
      from: z.string().describe("Start of the search window."),
      to: z.string().describe("End of the search window."),
      durationMinutes: z.number().optional().describe("Required slot length (default 60)."),
      limit: z.number().optional(),
    }),
    async handler(args, ctx) {
      const from = parseWhen(String(args.from ?? ""), ctx.user.timezone) ?? ctx.now;
      const to = parseWhen(String(args.to ?? ""), ctx.user.timezone) ?? addZonedDays(ctx.now, 7, ctx.user.timezone);
      const durationMinutes = typeof args.durationMinutes === "number" ? Math.round(args.durationMinutes) : 60;

      const slots = await findSlots(ctx.user, {
        from,
        to,
        durationMinutes,
        maxSlots: typeof args.limit === "number" ? Math.min(10, Math.round(args.limit)) : 5,
      });

      return {
        data: {
          durationMinutes,
          timezone: ctx.user.timezone,
          slots: slots.map((slot) => ({
            start: isoLocal(slot.start, ctx.user.timezone),
            end: isoLocal(slot.end, ctx.user.timezone),
          })),
        },
      };
    },
  },

  {
    name: "create_task",
    description: "Add a task to a domain, optionally with a due date and estimate.",
    schema: z.object({
      domain: z.string(),
      title: z.string(),
      dueDate: z.string().optional().describe("Due date/time in the user's timezone."),
      estimateMinutes: z.number().optional(),
      priority: z.number().optional().describe("0 low, 1 normal, 2 high."),
    }),
    async handler(args, ctx) {
      const domainSlug = resolveDomainSlug(String(args.domain ?? ""));
      if (!domainSlug) return { data: { error: "Unknown domain." } };

      const dueDate = typeof args.dueDate === "string" ? parseWhen(args.dueDate, ctx.user.timezone) : null;
      const result = await createTask(ctx.user, {
        domainSlug,
        title: String(args.title ?? "").slice(0, 160),
        dueDate,
        estimateMinutes: typeof args.estimateMinutes === "number" ? Math.round(args.estimateMinutes) : 30,
        priority: typeof args.priority === "number" ? Math.round(args.priority) : 1,
      });

      if (!result.ok) return { data: { error: result.message } };

      const domain = DOMAIN_MAP[domainSlug];
      return {
        data: {
          saved: true,
          task: {
            id: result.task.id,
            title: result.task.title,
            domain: domainSlug,
            due: result.task.dueDate ? isoLocal(result.task.dueDate, ctx.user.timezone) : null,
          },
        },
        inverse: result.inverse ? [result.inverse] : undefined,
        change: {
          kind: "task",
          action: "created",
          title: result.task.title,
          domainSlug,
          domainName: domain?.name ?? domainSlug,
          domainAccent: domain?.accent ?? "#7c5cff",
          start: result.task.dueDate?.toISOString(),
        },
      };
    },
  },

  {
    name: "update_task",
    description: "Mark a task done or change its status, due date or title.",
    schema: z.object({
      taskId: z.string().optional(),
      title: z.string().optional().describe("Part of the task title."),
      status: z.enum(["todo", "doing", "done", "slipped"]).optional(),
      dueDate: z.string().optional(),
    }),
    async handler(args, ctx) {
      const tasks = await listTasks(ctx.user, { limit: 100 });
      const taskId = typeof args.taskId === "string" ? args.taskId : undefined;
      const needle = typeof args.title === "string" ? args.title.toLowerCase() : "";

      const task =
        tasks.find((candidate) => candidate.id === taskId) ??
        tasks.find((candidate) => needle && candidate.title.toLowerCase().includes(needle));

      if (!task) return { data: { error: "I could not find that task." } };

      const result = await updateTask(ctx.user, task.id, {
        status: typeof args.status === "string" ? args.status : "done",
        ...(typeof args.dueDate === "string"
          ? { dueDate: parseWhen(args.dueDate, ctx.user.timezone) }
          : {}),
      });

      if (!result.ok) return { data: { error: result.message } };

      return {
        data: { saved: true, task: { id: task.id, title: task.title, status: result.task.status } },
        inverse: result.inverse ? [result.inverse] : undefined,
        change: {
          kind: "task",
          action: "completed",
          title: task.title,
          domainSlug: task.domainSlug,
          domainName: task.domainName,
          domainAccent: task.domainAccent,
        },
      };
    },
  },

  {
    name: "plan_backwards",
    description:
      "Turn a deadline into work blocks placed in free slots before it. Preview first; only pass confirm=true after the user agrees.",
    schema: z.object({
      title: z.string().describe("What the work is, e.g. Hackathon submission."),
      domain: z.string(),
      deadline: z.string().describe("Deadline in the user's timezone."),
      totalMinutes: z.number().optional().describe("Total work needed (default 240)."),
      blockMinutes: z.number().optional().describe("Length of each block (default 60)."),
      maxBlocks: z.number().optional(),
      confirm: z.boolean().optional(),
    }),
    async handler(args, ctx) {
      const domainSlug = resolveDomainSlug(String(args.domain ?? ""));
      if (!domainSlug) return { data: { error: "Unknown domain." } };

      const deadline = parseWhen(String(args.deadline ?? ""), ctx.user.timezone);
      if (!deadline) return { data: { error: "Could not understand the deadline." } };

      const totalMinutes = typeof args.totalMinutes === "number" ? Math.round(args.totalMinutes) : 240;
      const blockMinutes = typeof args.blockMinutes === "number" ? Math.round(args.blockMinutes) : 60;
      const maxBlocks = Math.min(
        typeof args.maxBlocks === "number" ? Math.round(args.maxBlocks) : 6,
        Math.ceil(totalMinutes / blockMinutes),
        8,
      );

      const from = startOfZonedDay(ctx.now, ctx.user.timezone);
      if (deadline <= from) return { data: { error: "That deadline is in the past." } };

      const slots = await findSlots(ctx.user, {
        from: addZonedDays(ctx.now, 0, ctx.user.timezone),
        to: deadline,
        durationMinutes: blockMinutes,
        maxSlots: maxBlocks,
        skipWeekdays: [],
      });

      if (!slots.length) {
        return { data: { error: "No free slots before that deadline. Try a shorter block or free something up." } };
      }

      if (args.confirm !== true) {
        return {
          data: {
            preview: true,
            proposed: { domain: domainSlug, title: args.title ? String(args.title) : "Planned work" },
            blocks: slots.map((slot) => ({
              start: isoLocal(slot.start, ctx.user.timezone),
              end: isoLocal(slot.end, ctx.user.timezone),
            })),
            totalMinutes: slots.length * blockMinutes,
            instruction: "Show these blocks and ask the user to confirm before creating them.",
          },
        };
      }

      const created: ChangeSummary[] = [];
      const inverses: InverseOp[] = [];
      for (const slot of slots) {
        const result = await createEvent(ctx.user, {
          domainSlug,
          title: args.title ? String(args.title) : "Planned work",
          start: slot.start,
          end: slot.end,
          status: "suggested",
          source: "auto",
          force: true,
        });
        if (result.ok && result.event) {
          created.push({ kind: "event", action: "suggested", ...summarise(result.event) });
          if (result.inverse) inverses.push(result.inverse);
        }
      }

      return {
        data: {
          saved: true,
          created: created.length,
          blocks: created.map((block) => ({
            title: block.title,
            start: block.start ? isoLocal(new Date(block.start), ctx.user.timezone) : null,
          })),
        },
        inverse: inverses,
        change: created[0],
        changes: created,
      };
    },
  },

  {
    name: "save_memory",
    description:
      "Remember a durable preference or decision for a domain, e.g. 'prefers karate at 7pm' or 'exam is on 12 Nov'.",
    schema: z.object({
      note: z.string().describe("The fact to remember, in one short sentence."),
      domain: z.string().optional().describe("Domain slug to attach it to (default planning)."),
    }),
    async handler(args, ctx) {
      const domainSlug = resolveDomainSlug(String(args.domain ?? "planning")) ?? "planning";
      const note = String(args.note ?? "").slice(0, 500);
      if (!note) return { data: { error: "Nothing to remember." } };

      await saveMemory(ctx.userId, domainSlug, note);
      const recalled = await recallMemories(ctx.userId, note, { limit: 3 });

      return {
        data: {
          saved: true,
          domain: domainSlug,
          note,
          related: recalled.filter((memory) => memory.note !== note).map((memory) => memory.note),
        },
      };
    },
  },
];

export const TOOL_MAP = new Map(TOOLS.map((tool) => [tool.name, tool]));

/** JSON Schema payload expected by the OpenAI-compatible tools API. */
export function toolSpecs() {
  return TOOLS.map((tool) => {
    const schema = z.toJSONSchema(tool.schema) as Record<string, unknown>;
    delete schema.$schema;
    return {
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: schema,
      },
    };
  });
}
