/**
 * Natural-language understanding for the chat agent.
 *
 * This module is deliberately pure: no database, no network, no clock of its
 * own. It turns "move karate to 7 pm tomorrow" into a structured intent that
 * the rules engine and the tests can rely on. When DeepSeek is configured the
 * model does the same job, but this parser remains the safety net that keeps
 * the app usable without an API key (and during a provider outage).
 */

import { DOMAINS, type DomainSlug } from "@/lib/domains/catalog";
import { startOfZonedDay, utcToZoned, zonedToUtc } from "@/lib/time";

export type IntentKind =
  | "query"
  | "free_slots"
  | "create"
  | "move"
  | "cancel"
  | "task"
  | "complete"
  | "plan"
  | "undo"
  | "unknown";

export interface ParsedWhen {
  date: Date;
  /** A clock time was present in the text. */
  explicitTime: boolean;
  /** An explicit calendar date (not just "today"/"tomorrow") was present. */
  explicitDate: boolean;
  /** Local minutes since midnight, when a time was given. */
  minutes: number | null;
}

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

const NUMBER_WORDS: Record<string, number> = {
  an: 1,
  a: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

/** Words that describe a domain in the way people actually type. */
const DOMAIN_KEYWORDS: Record<DomainSlug, string[]> = {
  career: ["career", "job", "cv", "resume", "résumé", "linkedin", "application", "interview", "recruiter", "internship"],
  education: [
    "education",
    "study",
    "studying",
    "exam",
    "revision",
    "revise",
    "lecture",
    "assignment",
    "class",
    "college",
    "university",
    "course",
    "semester",
    "notes",
    "mock test",
  ],
  competitions: ["competitions", "competition", "hackathon", "pitch", "contest", "judging", "submission", "demo day"],
  volunteering: ["volunteering", "volunteer", "ngo", "charity", "community", "shift"],
  "open-source": ["open source", "open-source", "github", "pull request", "pr review", "issue", "repository", "repo"],
  food: ["food", "lunch", "dinner", "breakfast", "meal", "eat", "cook", "kitchen", "brunch"],
  sleep: ["sleep", "bed", "bedtime", "nap", "wind down", "wake", "rest night"],
  karate: ["karate", "dojo", "kata", "grading", "belt", "sensei", "sparring", "martial"],
  blogging: ["blog", "blogging", "post", "draft", "article", "newsletter", "write", "writing"],
  learning: ["learning", "learn", "skill", "course module", "practice", "tutorial", "workshop"],
  planning: ["planning", "plan", "review", "goals", "roadmap", "retro", "weekly review", "monthly"],
  rest: ["rest", "buffer", "downtime", "break", "slack", "recharge", "offline"],
  finance: ["finance", "budget", "payment", "fee", "prize", "scholarship", "money", "invoice", "expense"],
  admin: ["admin", "form", "renewal", "renew", "paperwork", "document", "deadline", "submit form", "registration"],
  social: ["social", "friend", "friends", "family", "mentor", "call", "catch up", "catch-up", "dinner with"],
  portfolio: ["portfolio", "project write-up", "case study", "certificate", "achievement", "resume project"],
  travel: ["travel", "commute", "flight", "train", "bus", "cab", "airport", "drive", "journey"],
  habits: ["habits", "habit", "check-in", "checkin", "reflection", "journal", "mood", "streak", "gym", "workout", "meditate"],
};

export function normalise(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Detect the most likely domain for a sentence. */
export function detectDomain(text: string): DomainSlug | null {
  const lower = ` ${normalise(text)} `;
  let best: { slug: DomainSlug; score: number } | null = null;

  for (const domain of DOMAINS) {
    const keywords = [domain.slug.replace(/-/g, " "), ...DOMAIN_KEYWORDS[domain.slug]];
    let score = 0;
    for (const keyword of keywords) {
      if (lower.includes(` ${keyword}`) || lower.includes(`${keyword} `)) {
        score = Math.max(score, keyword.length);
      }
    }
    if (score > 0 && (!best || score > best.score)) best = { slug: domain.slug, score };
  }

  return best?.slug ?? null;
}

/** "2 hours" → 120, "90 mins" → 90, "half an hour" → 30. */
export function parseDuration(text: string): number | null {
  const lower = normalise(text);

  const hours = lower.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/);
  if (hours) return Math.round(Number(hours[1]) * 60);

  const minutes = lower.match(/(\d{1,3})\s*(?:minutes?|mins?|m)\b/);
  if (minutes) return Number(minutes[1]);

  if (/\bhalf an hour\b|\bhalf hour\b/.test(lower)) return 30;
  if (/\ban hour\b|\bone hour\b/.test(lower)) return 60;

  const worded = lower.match(/\b(an|a|one|two|three|four|five)\s+hours?\b/);
  if (worded) return (NUMBER_WORDS[worded[1]] ?? 1) * 60;

  return null;
}

/** "every monday", "daily", "weekdays" → the stored recurrence syntax. */
export function parseRecurrenceText(text: string): string | null {
  const lower = normalise(text);
  if (/\bevery day\b|\bdaily\b|\beach day\b/.test(lower)) return "DAILY";

  const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const codes = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  const found: string[] = [];
  for (let index = 0; index < weekdays.length; index += 1) {
    const short = weekdays[index].slice(0, 3);
    if (new RegExp(`\\b(${weekdays[index]}|${short})\\b`).test(lower) && /\bevery\b|\beach\b/.test(lower)) {
      found.push(codes[index]);
    }
  }
  if (found.length) return `WEEKLY:${found.join(",")}`;

  if (/\bweekdays\b/.test(lower)) return "WEEKLY:MO,TU,WE,TH,FR";
  if (/\bevery week\b|\bweekly\b|\beach week\b/.test(lower)) return "WEEKLY";
  return null;
}

interface ClockRead {
  minutes: number;
  consumed: string;
}

/** Read a clock time from text: "7 pm", "19:00", "at 7", "noon". */
export function parseClock(text: string): ClockRead | null {
  const lower = normalise(text);

  const meridiem = lower.match(/(?:^|\s|at\s)(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (meridiem) {
    let hour = Number(meridiem[1]) % 12;
    if (meridiem[3] === "pm") hour += 12;
    return { minutes: hour * 60 + Number(meridiem[2] ?? 0), consumed: meridiem[0] };
  }

  const iso = lower.match(/(?:^|\s)(\d{1,2}):(\d{2})\b/);
  if (iso) {
    const hour = Number(iso[1]);
    const minute = Number(iso[2]);
    if (hour <= 23 && minute <= 59) return { minutes: hour * 60 + minute, consumed: iso[0] };
  }

  const bare = lower.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\b/);
  if (bare) {
    let hour = Number(bare[1]);
    const minute = Number(bare[2] ?? 0);
    // "at 7" from a human almost always means 7pm; "at 9" means 9am.
    if (hour <= 7) hour += 12;
    return { minutes: Math.min(hour, 23) * 60 + minute, consumed: bare[0] };
  }

  if (/\bnoon\b/.test(lower)) return { minutes: 12 * 60, consumed: "noon" };
  if (/\bmidnight\b/.test(lower)) return { minutes: 0, consumed: "midnight" };
  if (/\btonight\b/.test(lower)) return { minutes: 20 * 60, consumed: "tonight" };
  if (/\bthis evening\b|\bin the evening\b/.test(lower)) return { minutes: 19 * 60, consumed: "evening" };
  if (/\bthis afternoon\b|\bin the afternoon\b/.test(lower)) return { minutes: 15 * 60, consumed: "afternoon" };
  if (/\bthis morning\b|\bin the morning\b/.test(lower)) return { minutes: 9 * 60, consumed: "morning" };
  if (/\bnight\b/.test(lower)) return { minutes: 20 * 60, consumed: "night" };

  return null;
}

/**
 * Resolve "today", "tomorrow", "friday", "12 nov", "in 10 days" into a UTC
 * instant, using the user's wall clock rather than the server's.
 */
export function parseWhen(text: string, now: Date, timeZone: string): ParsedWhen | null {
  const lower = normalise(text);
  const today = startOfZonedDay(now, timeZone);
  const local = utcToZoned(today, timeZone);

  let target: { year: number; month: number; day: number } | null = null;
  let explicitDate = false;

  const iso = lower.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    target = { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) };
    explicitDate = true;
  }

  if (!target) {
    const inDays = lower.match(/\bin\s+(\d{1,3})\s+days?\b/);
    if (inDays) {
      const shift = new Date(Date.UTC(local.year, local.month - 1, local.day + Number(inDays[1])));
      target = {
        year: shift.getUTCFullYear(),
        month: shift.getUTCMonth() + 1,
        day: shift.getUTCDate(),
      };
      explicitDate = true;
    }
  }

  if (!target) {
    const monthDay = lower.match(
      /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\b/,
    );
    const dayMonth = lower.match(
      /\b(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s+(\d{1,2})(?:st|nd|rd|th)?\b/,
    );
    const month = monthDay?.[2] ?? dayMonth?.[1];
    const day = monthDay?.[1] ?? dayMonth?.[2];
    if (month && day) {
      const monthIndex = MONTHS[month];
      const year = monthIndex < local.month ? local.year + 1 : local.year;
      target = { year, month: monthIndex, day: Number(day) };
      explicitDate = true;
    }
  }

  if (!target) {
    const weekdayMatch = lower.match(
      /\b(sunday|sun|monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat)\b/,
    );
    if (weekdayMatch) {
      const wanted = WEEKDAYS[weekdayMatch[1]];
      const currentWeekday = local.weekday;
      let delta = (wanted - currentWeekday + 7) % 7;
      if (delta === 0) delta = 7; // "Monday" on a Monday means next Monday
      if (/\bnext\b/.test(lower)) delta += 0;
      const shift = new Date(Date.UTC(local.year, local.month - 1, local.day + delta));
      target = {
        year: shift.getUTCFullYear(),
        month: shift.getUTCMonth() + 1,
        day: shift.getUTCDate(),
      };
    }
  }

  if (!target) {
    if (/\bday after tomorrow\b/.test(lower)) {
      const shift = new Date(Date.UTC(local.year, local.month - 1, local.day + 2));
      target = { year: shift.getUTCFullYear(), month: shift.getUTCMonth() + 1, day: shift.getUTCDate() };
    } else if (/\btomorrow\b|\btmrw\b|\btmr\b/.test(lower)) {
      const shift = new Date(Date.UTC(local.year, local.month - 1, local.day + 1));
      target = { year: shift.getUTCFullYear(), month: shift.getUTCMonth() + 1, day: shift.getUTCDate() };
    } else if (/\btoday\b|\btonight\b|\bthis morning\b|\bthis afternoon\b|\bthis evening\b/.test(lower)) {
      target = { year: local.year, month: local.month, day: local.day };
    } else if (/\bnext week\b/.test(lower)) {
      const shift = new Date(Date.UTC(local.year, local.month - 1, local.day + 7));
      target = { year: shift.getUTCFullYear(), month: shift.getUTCMonth() + 1, day: shift.getUTCDate() };
    }
  }

  const clock = parseClock(lower);
  if (!target && !clock) return null;

  const day = target ?? { year: local.year, month: local.month, day: local.day };
  const minutes = clock ? clock.minutes : 9 * 60;

  return {
    date: zonedToUtc({ ...day, hour: Math.floor(minutes / 60), minute: minutes % 60 }, timeZone),
    explicitTime: Boolean(clock),
    explicitDate,
    minutes: clock?.minutes ?? null,
  };
}

/** Which verb the message is really asking for? */
export function detectIntent(text: string): IntentKind {
  const lower = normalise(text);

  if (/^(undo|revert|rollback)\b|\bundo (that|this|last|it)\b/.test(lower)) return "undo";
  if (/\b(find|show|suggest|give me)\b.*\b(free|open|available)\b|\bfree (time|slot|slots)\b|\bwhen am i free\b/.test(lower)) {
    return "free_slots";
  }
  if (
    /\bplan (revision|study|work|backwards|out)\b|\bplan backwards\b|\brevision (blocks?|sessions?)\b|\bwork blocks? for\b|\bprepare for (my |the )?(exam|pitch|hackathon)\b/.test(
      lower,
    )
  ) {
    return "plan";
  }
  if (/\b(mark|tick)\b.*\b(done|complete|finished)\b|\b(done|finished|complete[d]?) (with |the )?\b|\bmark .* as done\b/.test(lower)) {
    return "complete";
  }
  if (/\b(cancel|delete|remove|drop|clear)\b/.test(lower)) return "cancel";
  if (/\b(move|shift|push|reschedule|bring)\b/.test(lower)) return "move";
  if (/\b(task|todo|to-do|remind me|add .* task|need to)\b/.test(lower)) return "task";
  if (/\b(what|whats|what's|show|list|do i have|am i|schedule|when is|how busy)\b/.test(lower)) return "query";
  if (/\b(block|add|book|schedule|create|put|reserve|set up|slot)\b/.test(lower)) return "create";
  return "unknown";
}

/** True when the user is agreeing to a previously proposed change. */
export function isAffirmative(text: string): boolean {
  const lower = normalise(text).replace(/[.!?,]/g, "");
  if (isNegative(lower)) return false;
  return /^(yes|yep|yeah|yup|sure|ok|okay|do it|save it|save anyway|save them|add it|add them|please do|go ahead|confirm|confirmed|sounds good|fine|that works)\b/.test(
    lower,
  );
}

export function isNegative(text: string): boolean {
  const lower = normalise(text).replace(/[.!?,]/g, "");
  return /^(no|nope|nah|don't|dont|do not|not now|never mind|nevermind|cancel that|stop|skip)\b/.test(lower);
}

const FILLER_WORDS = new Set([
  "please",
  "can",
  "you",
  "could",
  "would",
  "i",
  "we",
  "me",
  "my",
  "our",
  "the",
  "a",
  "an",
  "to",
  "for",
  "at",
  "on",
  "in",
  "of",
  "and",
  "with",
  "some",
  "up",
  "it",
  "that",
  "this",
  "block",
  "add",
  "create",
  "schedule",
  "book",
  "put",
  "reserve",
  "set",
  "move",
  "shift",
  "push",
  "reschedule",
  "cancel",
  "delete",
  "remove",
  "drop",
  "mark",
  "done",
  "complete",
  "completed",
  "task",
  "todo",
  "remind",
  "session",
  "slot",
  "hours",
  "hour",
  "minutes",
  "minute",
  "mins",
  "today",
  "tomorrow",
  "tonight",
  "next",
  "week",
  "morning",
  "afternoon",
  "evening",
  "night",
  "pm",
  "am",
  "from",
  "until",
  "till",
  "about",
  "again",
  "new",
  "time",
  "let's",
  "lets",
]);

/**
 * Pull a human title out of a command: "Block 2 hours for the pitch tomorrow"
 * → "Pitch". Falls back to the original text when nothing useful is left.
 */
export function extractTitle(text: string, fallback = "Planned block"): string {
  const cleaned = text
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ")
    .replace(/\b\d{1,2}(?::\d{2})?\s*(am|pm)\b/gi, " ")
    .replace(/\b\d{1,2}:\d{2}\b/g, " ")
    .replace(/\b\d+(?:\.\d+)?\s*(hours?|hrs?|h|minutes?|mins?|m)\b/gi, " ")
    .replace(/\b(in|on)\s+\d{1,3}\s+days?\b/gi, " ")
    .replace(
      /\b(\d{1,2})(st|nd|rd|th)?\s+(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\b/gi,
      " ",
    )
    .replace(
      /\b(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s+\d{1,2}(st|nd|rd|th)?\b/gi,
      " ",
    )
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ");

  const words = cleaned
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !FILLER_WORDS.has(word.toLowerCase()))
    .filter((word) => !Object.prototype.hasOwnProperty.call(WEEKDAYS, word.toLowerCase()));

  if (!words.length) return fallback;
  const title = words.join(" ").trim();
  return title.length > 80 ? `${title.slice(0, 77)}…` : title;
}

/** Sentence case for a title pulled out of chat. */
export function titleCase(value: string): string {
  if (!value) return value;
  const lower = value.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
