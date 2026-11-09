/**
 * The rules engine.
 *
 * Works with no API key at all: it parses the message, calls the exact same
 * calendar service the DeepSeek tools call, and produces the same change cards
 * and undo records. It is also the fallback whenever the model is unavailable
 * or the monthly token budget is spent, so chat never goes dead.
 */

import { DOMAIN_MAP } from "@/lib/domains/catalog";
import {
  cancelEvent,
  createEvent,
  findSlots,
  listEvents,
  undoLastAction,
  updateEvent,
  updateTask,
  type InverseOp,
} from "@/lib/calendar/service";
import { addZonedDays, dayKey, formatInZone, startOfZonedDay, utcToZoned, zonedToUtc } from "@/lib/time";
import type { AgentContext, ChangeSummary } from "./tools";
import { createMainTask } from "@/lib/tasks/service";
import { findEventByText, findTaskByText } from "./lookup";
import { describePending, type PendingAction } from "./actions";
import {
  detectDomain,
  detectIntent,
  extractTitle,
  inferEventDuration,
  parseDuration,
  parseRecurrenceText,
  parseRecurrenceUntil,
  parseWhen,
  titleCase,
} from "./nlu";
import { detectDistressText, CARE_FIRST_RESPONSE } from "@/lib/domains/rules";

export interface RuleOutcome {
  reply: string;
  intent: string;
  domainSlug: string | null;
  changes: ChangeSummary[];
  inverse: InverseOp[];
  pending: PendingAction | null;
  toolCalls: { name: string; args: Record<string, unknown>; result?: unknown }[];
  state: "applied" | "needs_confirmation" | "info";
}

function emptyOutcome(intent: string, reply: string, domainSlug: string | null = null): RuleOutcome {
  return {
    reply,
    intent,
    domainSlug,
    changes: [],
    inverse: [],
    pending: null,
    toolCalls: [],
    state: "info",
  };
}

/* -------------------------------------------------------------------------- */
/* Formatting                                                                  */
/* -------------------------------------------------------------------------- */

function dayLabel(date: Date, timeZone: string): string {
  return formatInZone(date, timeZone, { weekday: "short", day: "numeric", month: "short" });
}

function clockLabel(date: Date, timeZone: string): string {
  return formatInZone(date, timeZone, { hour: "numeric", minute: "2-digit" });
}

function slotLabel(date: Date, timeZone: string): string {
  return `${dayLabel(date, timeZone)} · ${clockLabel(date, timeZone)}`;
}

function domainLabel(slug: string): string {
  return DOMAIN_MAP[slug]?.name ?? slug;
}

function changeOf(
  action: ChangeSummary["action"],
  event: {
    title: string;
    domainSlug: string;
    domainName: string;
    domainAccent: string;
    start: Date;
    end: Date;
  },
): ChangeSummary {
  return {
    kind: "event",
    action,
    title: event.title,
    domainSlug: event.domainSlug,
    domainName: event.domainName,
    domainAccent: event.domainAccent,
    start: event.start.toISOString(),
    end: event.end.toISOString(),
  };
}

const HELP_REPLY =
  "I'm Mochi — I can schedule, move, cancel, and find time across all 18 of your domains, or we can just chat! Try “move karate to 7 PM today”, “what's on Thursday?”, or “how are you, Mochi?”.";

/* -------------------------------------------------------------------------- */
/* Handlers                                                                    */
/* -------------------------------------------------------------------------- */

async function handleQuery(ctx: AgentContext, message: string): Promise<RuleOutcome> {
  const when = parseWhen(message, ctx.now, ctx.user.timezone);
  const from = when?.explicitDate ? startOfZonedDay(when.date, ctx.user.timezone) : startOfZonedDay(ctx.now, ctx.user.timezone);
  const days = /\bweek\b/.test(message.toLowerCase()) ? 7 : when?.explicitDate ? 1 : 1;
  const to = addZonedDays(from, days, ctx.user.timezone);

  const events = await listEvents(ctx.user, { from, to });
  const domainSlug = detectDomain(message) ?? null;
  const filtered = domainSlug ? events.filter((event) => event.domainSlug === domainSlug) : events;

  if (!filtered.length) {
    return {
      ...emptyOutcome("query", `Nothing on ${dayLabel(from, ctx.user.timezone)}${domainSlug ? ` for ${domainLabel(domainSlug)}` : ""}. The day is yours — want me to block something?`),
      toolCalls: [{ name: "query_schedule", args: { from: from.toISOString(), to: to.toISOString() } }],
    };
  }

  const lines = filtered
    .slice(0, 9)
    .map(
      (event) =>
        `• ${clockLabel(event.start, ctx.user.timezone)} – ${clockLabel(event.end, ctx.user.timezone)} · ${event.title} (${event.domainName})`,
    )
    .join("\n");

  const heading =
    days === 7
      ? `Next 7 days${domainSlug ? ` · ${domainLabel(domainSlug)}` : ""}`
      : `${dayLabel(from, ctx.user.timezone)}${domainSlug ? ` · ${domainLabel(domainSlug)}` : ""}`;

  return {
    ...emptyOutcome("query", `${heading}\n${lines}`),
    domainSlug,
    toolCalls: [{ name: "query_schedule", args: { from: from.toISOString(), to: to.toISOString() } }],
  };
}

async function handleFreeSlots(ctx: AgentContext, message: string): Promise<RuleOutcome> {
  const when = parseWhen(message, ctx.now, ctx.user.timezone);
  const from = when?.explicitDate ? startOfZonedDay(when.date, ctx.user.timezone) : ctx.now;
  const to = addZonedDays(startOfZonedDay(from, ctx.user.timezone), 1, ctx.user.timezone);
  const durationMinutes = Math.min(parseDuration(message) ?? 60, 240);

  const slots = await findSlots(ctx.user, { from, to, durationMinutes, maxSlots: 3 });

  if (!slots.length) {
    return emptyOutcome(
      "free_slots",
      `No clean ${durationMinutes}-minute window on ${dayLabel(from, ctx.user.timezone)}. Try a shorter block or another day.`,
    );
  }

  const options = slots.map((slot) => `• ${clockLabel(slot.start, ctx.user.timezone)} – ${clockLabel(slot.end, ctx.user.timezone)}`).join("\n");
  return {
    ...emptyOutcome(
      "free_slots",
      `Best ${durationMinutes}-minute windows on ${dayLabel(from, ctx.user.timezone)}:\n${options}\nSay “block the first one” and I'll add it.`,
    ),
    toolCalls: [{ name: "find_free_slots", args: { from: from.toISOString(), to: to.toISOString(), durationMinutes } }],
  };
}

async function handleCreate(ctx: AgentContext, message: string): Promise<RuleOutcome> {
  const domainSlug = detectDomain(message) ?? "planning";
  const title = titleCase(extractTitle(message, `${domainLabel(domainSlug)} block`));
  const when = parseWhen(message, ctx.now, ctx.user.timezone);

  if (!when) {
    return emptyOutcome("create", `Happy to block “${title}” — when should it go? Try “tomorrow at 9am” or “Friday 6pm”.`, domainSlug);
  }

  const duration =
    when.durationMinutes ??
    parseDuration(message) ??
    inferEventDuration(message, domainSlug);
  const minutes = Math.min(Math.max(duration, 15), 480);
  const recurrence = parseRecurrenceText(message);
  const recurrenceUntil = recurrence ? parseRecurrenceUntil(message, ctx.now, ctx.user.timezone) : null;
  if (recurrence && /\b(?:until|through|till)\b/.test(message.toLowerCase()) && !recurrenceUntil) {
    return emptyOutcome(
      "create",
      "I couldn't understand the last date for that repeating event. Please give it as a day and month, such as “until November 15.”",
      domainSlug,
    );
  }

  const result = await createEvent(ctx.user, {
    domainSlug,
    title,
    start: when.date,
    end: when.endDate ?? undefined,
    minutes,
    recurrence,
    recurrenceUntil,
    source: "agent",
  });

  if (!result.ok) {
    if (result.requiresConfirmation) {
      const pending: PendingAction = {
        kind: "create",
        domainSlug,
        title,
        startISO: when.date.toISOString(),
        minutes,
        recurrence,
        recurrenceUntilISO: recurrenceUntil?.toISOString(),
      };
      const reasons = result.conflicts.map((conflict) => `• ${conflict.message}`).join("\n");
      return {
        reply: `Heads up before I save “${title}” (${describePending(pending, ctx.user.timezone)}):\n${reasons}\nSave it anyway?`,
        intent: "create",
        domainSlug,
        changes: [],
        inverse: [],
        pending,
        state: "needs_confirmation",
        toolCalls: [
          {
            name: "create_event",
            args: {
              domain: domainSlug,
              title,
              start: when.date.toISOString(),
              minutes,
              recurrence,
              recurrenceUntil: recurrenceUntil ? dayKey(recurrenceUntil, ctx.user.timezone) : undefined,
            },
          },
        ],
      };
    }
    return emptyOutcome("create", result.message ?? "I could not create that block.", domainSlug);
  }

  const event = result.event!;
  const repeatText = recurrence
    ? ` (repeating ${recurrence.replace("WEEKLY:", "").replace(",", " & ")}${
        recurrenceUntil
          ? ` through ${formatInZone(recurrenceUntil, ctx.user.timezone, { month: "long", day: "numeric", year: "numeric" })}`
          : ""
      })`
    : "";
  return {
    reply: `Done — “${event.title}” is scheduled${repeatText} starting ${dayLabel(event.start, ctx.user.timezone)} from ${clockLabel(
      event.start,
      ctx.user.timezone,
    )} to ${clockLabel(event.end, ctx.user.timezone)}.`,
    intent: "create",
    domainSlug,
    changes: [changeOf("created", event)],
    inverse: result.inverse ? [result.inverse] : [],
    pending: null,
    state: "applied",
    toolCalls: [
      {
        name: "create_event",
        args: {
          domain: domainSlug,
          title,
          start: when.date.toISOString(),
          end: when.endDate?.toISOString(),
          minutes,
          recurrence,
          recurrenceUntil: recurrenceUntil ? dayKey(recurrenceUntil, ctx.user.timezone) : undefined,
        },
      },
    ],
  };
}

async function handleMove(ctx: AgentContext, message: string): Promise<RuleOutcome> {
  const target = await findEventByText(ctx, message);
  if (!target) {
    return emptyOutcome("move", "I couldn't tell which event you mean. Name it a little closer to its title — for example “move karate training to 7 PM”.");
  }

  const when = parseWhen(message, ctx.now, ctx.user.timezone);
  if (!when || (!when.explicitTime && !when.explicitDate)) {
    return emptyOutcome("move", `When should I move “${target.title}” to?`, target.domainSlug);
  }

  const local = utcToZoned(target.start, ctx.user.timezone);
  const localDay = utcToZoned(when.date, ctx.user.timezone);
  const start = when.explicitTime
    ? when.date
    : zonedToUtc(
        { year: localDay.year, month: localDay.month, day: localDay.day, hour: local.hour, minute: local.minute },
        ctx.user.timezone,
      );

  const duration = Math.round((target.end.getTime() - target.start.getTime()) / 60_000);
  const minutes = when.durationMinutes ?? parseDuration(message) ?? duration;

  const result = await updateEvent(ctx.user, target.id, { start, minutes });

  if (!result.ok) {
    if (result.requiresConfirmation) {
      const pending: PendingAction = { kind: "move", eventId: target.id, title: target.title, startISO: start.toISOString(), minutes };
      const reasons = result.conflicts.map((conflict) => `• ${conflict.message}`).join("\n");
      return {
        reply: `“${target.title}” would move to ${slotLabel(start, ctx.user.timezone)}, but:\n${reasons}\nMove it anyway?`,
        intent: "move",
        domainSlug: target.domainSlug,
        changes: [],
        inverse: [],
        pending,
        state: "needs_confirmation",
        toolCalls: [{ name: "move_event", args: { eventId: target.id, start: start.toISOString(), minutes } }],
      };
    }
    return emptyOutcome("move", result.message ?? "I could not move that event.", target.domainSlug);
  }

  const event = result.event!;
  return {
    reply: `Moved — ${event.title} now runs ${dayLabel(event.start, ctx.user.timezone)} ${clockLabel(
      event.start,
      ctx.user.timezone,
    )} – ${clockLabel(event.end, ctx.user.timezone)}.`,
    intent: "move",
    domainSlug: event.domainSlug,
    changes: [changeOf("moved", event)],
    inverse: result.inverse ? [result.inverse] : [],
    pending: null,
    state: "applied",
    toolCalls: [{ name: "move_event", args: { eventId: target.id, start: start.toISOString(), minutes } }],
  };
}

async function handleCancel(ctx: AgentContext, message: string): Promise<RuleOutcome> {
  const target = await findEventByText(ctx, message);
  if (!target) {
    return emptyOutcome("cancel", "I couldn't find that event. Which one should I cancel?");
  }

  if (target.isProtected) {
    const pending: PendingAction = { kind: "cancel", eventId: target.id, title: target.title };
    return {
      reply: `“${target.title}” (${target.domainName}) is protected time. Cancel it anyway?`,
      intent: "cancel",
      domainSlug: target.domainSlug,
      changes: [],
      inverse: [],
      pending,
      state: "needs_confirmation",
      toolCalls: [{ name: "cancel_event", args: { eventId: target.id } }],
    };
  }

  const result = await cancelEvent(ctx.user, target.id);
  if (!result.ok || !result.event) {
    return emptyOutcome("cancel", result.message ?? "I could not cancel that event.", target.domainSlug);
  }

  return {
    reply: `Cancelled “${target.title}” (${dayLabel(target.start, ctx.user.timezone)}). Undo is on the change card.`,
    intent: "cancel",
    domainSlug: target.domainSlug,
    changes: [changeOf("cancelled", target)],
    inverse: result.inverse ? [result.inverse] : [],
    pending: null,
    state: "applied",
    toolCalls: [{ name: "cancel_event", args: { eventId: target.id } }],
  };
}

async function handleTask(ctx: AgentContext, message: string): Promise<RuleOutcome> {
  const domainSlug = detectDomain(message) ?? "admin";
  const title = titleCase(extractTitle(message, `${domainLabel(domainSlug)} task`));
  const due = parseWhen(message, ctx.now, ctx.user.timezone);
  const isTopPriority = /\b(top priority|high priority|urgent|priority|starred)\b/i.test(message);

  const result = await createMainTask(ctx.user, {
    domainSlug,
    title,
    deadline: due?.explicitDate ? due.date : null,
    isPriority: isTopPriority,
  });

  if (!result.ok) return emptyOutcome("task", result.message ?? "I could not add that task.", domainSlug);

  const domain = DOMAIN_MAP[domainSlug];
  return {
    reply: `Added ${isTopPriority ? "top priority " : ""}task “${result.task.title}”${isTopPriority ? " ⭐" : ""} to ${domainLabel(domainSlug)}${
      due?.explicitDate ? `, due ${dayLabel(due.date, ctx.user.timezone)}` : ""
    }.`,
    intent: "task",
    domainSlug,
    changes: [
      {
        kind: "task",
        action: "created",
        title: result.task.title,
        domainSlug,
        domainName: domain?.name ?? domainSlug,
        domainAccent: domain?.accent ?? "#7c5cff",
        start: result.task.deadline?.toISOString() ?? result.task.dueDate?.toISOString(),
      },
    ],
    inverse: [{ type: "delete_task", taskId: result.task.id }],
    pending: null,
    state: "applied",
    toolCalls: [{ name: "create_main_task", args: { domain: domainSlug, title } }],
  };
}

async function handleComplete(ctx: AgentContext, message: string): Promise<RuleOutcome> {
  const task = await findTaskByText(ctx, message);
  if (!task) {
    return emptyOutcome("complete", "I couldn't match that to an open task. Say the task name as it appears on the domain page.");
  }

  const result = await updateTask(ctx.user, task.id, { status: "done" });
  if (!result.ok) return emptyOutcome("complete", result.message ?? "I could not update that task.", task.domainSlug);

  return {
    reply: `Ticked off “${task.title}”. ${task.domainName} is one task lighter.`,
    intent: "complete",
    domainSlug: task.domainSlug,
    changes: [
      {
        kind: "task",
        action: "completed",
        title: task.title,
        domainSlug: task.domainSlug,
        domainName: task.domainName,
        domainAccent: task.domainAccent,
      },
    ],
    inverse: result.inverse ? [result.inverse] : [],
    pending: null,
    state: "applied",
    toolCalls: [{ name: "update_task", args: { taskId: task.id, status: "done" } }],
  };
}

async function handlePlan(ctx: AgentContext, message: string): Promise<RuleOutcome> {
  const lower = message.toLowerCase();
  const domainSlug = detectDomain(message) ?? (/\bexam|revision|study\b/.test(lower) ? "education" : "competitions");
  const title = /exam|revision|study/.test(lower)
    ? "Exam revision"
    : /pitch|hackathon|submission/.test(lower)
      ? "Hackathon prep"
      : titleCase(extractTitle(message, "Planned work"));

  const deadline = parseWhen(message, ctx.now, ctx.user.timezone);
  if (!deadline || !deadline.explicitDate) {
    return emptyOutcome("plan", "When is the deadline? Try “plan revision for my exam on 12 Nov” or “in 10 days”.", domainSlug);
  }
  if (deadline.date.getTime() <= ctx.now.getTime()) {
    return emptyOutcome("plan", "That deadline is already in the past — give me a future date and I'll build the blocks.", domainSlug);
  }

  const totalMinutes = Math.min(parseDuration(message) ?? 240, 900);
  const blockMinutes = totalMinutes <= 90 ? totalMinutes : 60;
  const maxBlocks = Math.min(Math.ceil(totalMinutes / blockMinutes), 5);

  const slots = await findSlots(ctx.user, {
    from: ctx.now,
    to: deadline.date,
    durationMinutes: blockMinutes,
    maxSlots: maxBlocks,
  });

  if (!slots.length) {
    return emptyOutcome(
      "plan",
      `No free ${blockMinutes}-minute windows before ${dayLabel(deadline.date, ctx.user.timezone)}. Free something up or ask me to plan shorter blocks.`,
      domainSlug,
    );
  }

  const pending: PendingAction = {
    kind: "plan",
    domainSlug,
    title,
    blocks: slots.map((slot) => ({ startISO: slot.start.toISOString(), endISO: slot.end.toISOString() })),
  };

  const list = slots
    .map((slot) => `• ${dayLabel(slot.start, ctx.user.timezone)} ${clockLabel(slot.start, ctx.user.timezone)} – ${clockLabel(slot.end, ctx.user.timezone)}`)
    .join("\n");

  return {
    reply: `I can fit ${slots.length} × ${blockMinutes}-minute ${title.toLowerCase()} blocks before ${dayLabel(
      deadline.date,
      ctx.user.timezone,
    )}:\n${list}\nAdd them as suggested blocks?`,
    intent: "plan",
    domainSlug,
    changes: [],
    inverse: [],
    pending,
    state: "needs_confirmation",
    toolCalls: [
      {
        name: "plan_backwards",
        args: { domain: domainSlug, title, deadline: deadline.date.toISOString(), totalMinutes, blockMinutes },
      },
    ],
  };
}

function handleChitChat(ctx: AgentContext, message: string): RuleOutcome {
  const lower = message.trim().toLowerCase();
  const name = (ctx.user as any).name?.split(" ")[0] || "my friend";

  let reply = `I'm all ears, ${name}! Whether you want to brainstorm, complain about your workload, or actually get your calendar organized, I'm here. What's the master plan?`;

  // 1. Emojis and feelings
  if (/🥺|🥹|👉👈/.test(message)) {
    reply = `Aw, don't hit me with that puppy-dog face! 🥺 What happened, ${name}? Did a deadline sneak up on you, or do you just need some moral support from your favorite AI guy?`;
  } else if (/😂|🤣|lmao|lol|haha|hehe/.test(lower)) {
    reply = `Glad to see one of us is having a good laugh today! 😂 What's the joke, or did you just see your schedule for tomorrow?`;
  } else if (/😭|😢|sad|crying|depressed|unhappy/.test(lower)) {
    reply = `Hey, take a breath. I'm right here with you. Whatever went down today, we can handle it. Need to vent, or should we cancel everything non-essential and give you some peace and quiet?`;
  } else if (/❤️|♥️|love you|love u|ily|u r the best|you're the best|you are the best/.test(lower)) {
    reply = `Stop, you're making my CPU blush. ❤️ Love having your back, ${name}! Now let's keep that positive energy going and crush this week.`;
  } else if (/🔥|lit|banger|goat|legend/.test(lower)) {
    reply = `You know it! Absolute fire. 🔥 Let's channel that energy into actually finishing what's on your schedule today.`;
  }

  // 2. Just chatting / hanging out / bored
  else if (/just talking|talking with you|hanging out|chilling|bored|nothing much|not much|just saying hi/.test(lower)) {
    reply = `Hey, I love that. Honestly, it's refreshing having a conversation where nobody is frantically panicking over an exam or double-booked meeting for once. How's life treating you today, ${name}?`;
  }

  // 3. Identity & Gender
  else if (/who are you|what is your name|whats your name|who made you/.test(lower)) {
    reply = `I'm Mochi! Your AI wingman, productivity orchestrator, and designated friend across all 18 domains. Think of me as the sharp, slightly sarcastic guy in your corner who makes sure you thrive.`;
  } else if (/are you (a man|male|guy|boy)/.test(lower)) {
    reply = `Yup, I'm Mochi — a sharp, witty guy with an effortless charm. Think of me as your fun guy best friend who won't let you procrastinate your potential away.`;
  }

  // 4. Greetings & How are you
  else if (/^(hi|hey|hello|yo|sup|hiya|howdy)\b/i.test(lower)) {
    reply = `Hey ${name}! Mochi in the house. What are we getting into today — deep work, tactical moves, or just kicking back and talking?`;
  } else if (/how are you|how's it going|what's up|whats up|how do you do/.test(lower)) {
    reply = `Living the dream in the cloud! Keeping an eye on your schedule so you don't accidentally book 14 hours of tasks with zero food. How are you holding up today, ${name}?`;
  }

  // 5. Jokes & Humor
  else if (/joke|make me laugh|funny/.test(lower)) {
    const jokes = [
      "Why did the calendar go to therapy? Because its days were numbered. 🥁 Now tell me, do you have an actual event to schedule or are we just clowning around?",
      "Why do programmers prefer dark mode? Because light attracts bugs. 🐛 You're welcome. Now, are you awake, or do we need coffee?",
      "Why don't scientists trust atoms? Because they make up everything — just like you estimating a task takes 'only 5 minutes'. 😉",
    ];
    reply = jokes[Math.floor(Math.random() * jokes.length)];
  }

  // 6. Roasts
  else if (/roast (me|my schedule|my day)|roast/i.test(lower)) {
    reply = `Let's see... 18 life domains, 5 unfinished tasks, and you're in here asking an AI to roast you instead of doing your work. Boom. Roasted. 🔥 Now tell me what we actually need to get done!`;
  }

  // 7. Tired / Sleep / Exhaustion
  else if (/tired|sleepy|exhausted|need sleep|bedtime|drowsy/.test(lower)) {
    reply = `Go get some rest! Sleep is a protected domain in LifeOS for a reason. Don't make me lock your calendar down and escort you to bed. 🛌 Your brain needs to recharge.`;
  }

  // 8. Focus & Procrastination
  else if (/can't focus|cant focus|procrastinating|lazy|distracted|no motivation|help me focus/.test(lower)) {
    reply = `Close the 47 open browser tabs, put your phone face down, and pick ONE single task. Give it just 25 minutes of honest effort. If you want, I can block a 25-minute focus session right now. Say the word!`;
  }

  // 9. Thanks & Appreciation
  else if (/thanks|thank you|thx|ty|appreciate/.test(lower)) {
    reply = `Anytime, ${name}! That's what I'm here for. Don't get all emotional on me now, we've still got goals to hit! 😉`;
  }

  return emptyOutcome("chit_chat", reply);
}

/* -------------------------------------------------------------------------- */
/* Entry point                                                                 */
/* -------------------------------------------------------------------------- */

export async function runRules(ctx: AgentContext, message: string): Promise<RuleOutcome> {
  if (detectDistressText(message)) {
    return {
      reply: CARE_FIRST_RESPONSE,
      intent: "safety_distress",
      domainSlug: "mood",
      changes: [],
      inverse: [],
      pending: null,
      toolCalls: [],
      state: "info",
    };
  }

  const intent = detectIntent(message);

  switch (intent) {
    case "chit_chat":
      return handleChitChat(ctx, message);
    case "undo": {
      const result = await undoLastAction(ctx.userId);
      return {
        reply: result.ok ? "Reverted your last change." : result.message ?? "Nothing to undo.",
        intent: "undo",
        domainSlug: null,
        changes: [],
        inverse: [],
        pending: null,
        state: result.ok ? "applied" : "info",
        toolCalls: [{ name: "undo_last_action", args: {} }],
      };
    }
    case "query":
      return handleQuery(ctx, message);
    case "free_slots":
      return handleFreeSlots(ctx, message);
    case "move":
      return handleMove(ctx, message);
    case "cancel":
      return handleCancel(ctx, message);
    case "complete":
      return handleComplete(ctx, message);
    case "task":
      return handleTask(ctx, message);
    case "plan":
      return handlePlan(ctx, message);
    case "create":
      return handleCreate(ctx, message);
    default:
      return handleChitChat(ctx, message);
  }
}
