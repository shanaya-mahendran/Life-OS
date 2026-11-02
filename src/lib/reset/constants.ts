/**
 * Shared Reset Plan constants.
 *
 * Everything the UI and the engine need to agree on lives here: the three
 * phases, the audit prompts, the hard limits, review dates and the starter
 * suggestions offered by the plan builder.
 */

export const RESET_ACCENT = "#8b5cf6";
export const HABITS_ACCENT = "#34d399";
export const RESET_DAYS = 90;

export const RESET_LIMITS = {
  cuts: 3,
  nonnegotiables: 3,
  goals: 3,
  challenges: 3,
  routines: 2,
  anchors: 4,
} as const;

export type ResetKind = "cut" | "anchor" | "routine" | "nonnegotiable" | "goal" | "challenge";

export interface ResetPhaseConfig {
  phase: 1 | 2 | 3;
  name: string;
  shortName: string;
  days: string;
  dayStart: number;
  dayEnd: number;
  goal: string;
  dailyRule: string;
  accent: string;
  kinds: ResetKind[];
}

export const RESET_PHASES: ResetPhaseConfig[] = [
  {
    phase: 1,
    name: "Cut the excess",
    shortName: "Month 1",
    days: "Days 1–30",
    dayStart: 1,
    dayEnd: 30,
    goal: "Drop what drags you down",
    dailyRule: "Same wake-up time. Finish one task.",
    accent: "#f472b6",
    kinds: ["cut", "anchor"],
  },
  {
    phase: 2,
    name: "Foundation",
    shortName: "Month 2",
    days: "Days 31–60",
    dayStart: 31,
    dayEnd: 60,
    goal: "Become consistent",
    dailyRule: "Do the three commitments.",
    accent: "#38bdf8",
    kinds: ["routine", "nonnegotiable"],
  },
  {
    phase: 3,
    name: "Broaden horizons",
    shortName: "Month 3",
    days: "Days 61–90",
    dayStart: 61,
    dayEnd: 90,
    goal: "Real growth",
    dailyRule: "Keep the routine. Work the goals.",
    accent: "#34d399",
    kinds: ["goal", "challenge"],
  },
];

export const PHASE_BY_NUMBER = new Map(RESET_PHASES.map((phase) => [phase.phase, phase]));

export const KIND_META: Record<
  ResetKind,
  { label: string; plural: string; description: string; icon: string; tracking: string }
> = {
  cut: {
    label: "Cut",
    plural: "Cuts",
    description: "A stop habit — something you give up for Month 1.",
    icon: "slash",
    tracking: "Days held vs days slipped",
  },
  anchor: {
    label: "Anchor",
    plural: "Anchors",
    description: "The two daily anchors: same wake-up time and one finished task.",
    icon: "anchor",
    tracking: "Done, skipped or missed",
  },
  routine: {
    label: "Routine",
    plural: "Routines",
    description: "Morning or evening routine you repeat every day.",
    icon: "sunrise",
    tracking: "Done rate by time of day",
  },
  nonnegotiable: {
    label: "Non-negotiable",
    plural: "Non-negotiables",
    description: "Three daily commitments that do not move.",
    icon: "shield",
    tracking: "Streak and adherence",
  },
  goal: {
    label: "Goal",
    plural: "Goals",
    description: "One goal each for finances, productivity and personal growth.",
    icon: "target",
    tracking: "Progress against target",
  },
  challenge: {
    label: "Challenge",
    plural: "Challenges",
    description: "A weekly challenge in discipline, responsibility or action.",
    icon: "flame",
    tracking: "Weeks completed",
  },
};

export const AUDIT_STEPS = [
  {
    step: 1,
    title: "Where am I right now?",
    eyebrow: "Step 1 · Honest starting point",
    prompt:
      "Describe your life as it is this week — time, energy, work, money, health, people. What is actually happening, not what you wish were happening?",
    hint: "Money, mood and health included. Nothing here is shared. Short, specific sentences work best.",
    placeholder:
      "I wake up around 8, most mornings start on my phone. Study blocks slip to the evening. I spend more than I plan to, and I have not trained in three weeks…",
  },
  {
    step: 2,
    title: "Where should I be in 90 days?",
    eyebrow: "Step 2 · The target",
    prompt:
      "In 90 days, what would be visibly different? Name the mornings, the work, the money and the people — the things you could point at.",
    hint: "Aim for a picture you can check, not a feeling. “Three applications sent” beats “be more confident”.",
    placeholder:
      "Up at 6:30 without hitting snooze. Two deep-work blocks before lunch. One finance review a week. Karate twice a week, and a real evening with family…",
  },
  {
    step: 3,
    title: "What happened when I tried before?",
    eyebrow: "Step 3 · The pattern",
    prompt:
      "What got in the way the last time you tried to change something? What did you tell yourself when you stopped?",
    hint: "This is the pattern the agent watches for. It is not a confession and it is never used as a score.",
    placeholder:
      "I start strong for a week, then a late night breaks the morning and the whole plan collapses. I usually quit quietly instead of restarting small…",
  },
] as const;

export const NOTEBOOK_QUESTIONS = [
  "What have I done to get closer to the life I want?",
  "Where have I shown weakness?",
  "What will I change tomorrow?",
] as const;

export const REVIEW_DAYS = [15, 30, 45, 60, 75, 90] as const;

export type ReviewDay = (typeof REVIEW_DAYS)[number];

export const GOAL_AREAS = [
  { value: "finances", label: "Finances" },
  { value: "productivity", label: "Productivity" },
  { value: "personal", label: "Personal growth" },
] as const;

export const GOAL_AREA_LABEL: Record<string, string> = {
  finances: "Finances",
  productivity: "Productivity",
  personal: "Personal growth",
};

export const COMMITMENT_SUGGESTIONS: Record<ResetKind, string[]> = {
  cut: [
    "No scrolling after 22:00",
    "No takeaway on weekdays",
    "No starting the day in bed with my phone",
    "No more than one hour of social media a day",
  ],
  anchor: ["Same wake-up time every day", "Finish one task before noon", "Evening check-in at the same time"],
  routine: [
    "Morning routine: water, light, ten minutes of movement",
    "Evening routine: close the day and set tomorrow's first task",
    "Morning routine: no phone for the first thirty minutes",
  ],
  nonnegotiable: [
    "One deep-work block",
    "Thirty minutes of movement",
    "Ten minutes of planning tomorrow",
    "Read ten pages",
  ],
  goal: [
    "Deep-work hours per week",
    "Money saved per week",
    "Practice sessions per week",
  ],
  challenge: [
    "One hard conversation per week",
    "One finished task before checking messages",
    "One thing that scares me, every week",
  ],
};

/** Starter anchors created the first time a draft plan is built. */
export const STARTER_ANCHORS = ["Same wake-up time every day", "Finish one task before noon"] as const;

export const CHECKIN_RESULTS = ["done", "skipped", "missed"] as const;
export type CheckinResult = (typeof CHECKIN_RESULTS)[number];

export const CHECKIN_LABEL: Record<CheckinResult, string> = {
  done: "Done",
  skipped: "Skipped",
  missed: "Missed",
};

export const NOTIFICATION_LABEL: Record<string, string> = {
  checkin: "Evening check-in",
  review: "Review due",
  report: "Report ready",
  drift: "Drift suggestion",
};

export function phaseForNumber(value: number): ResetPhaseConfig {
  return PHASE_BY_NUMBER.get(value as 1 | 2 | 3) ?? RESET_PHASES[0];
}

export function kindLabel(kind: string): string {
  return KIND_META[kind as ResetKind]?.label ?? kind;
}

export function reviewLabel(day: number, kind: string): string {
  if (kind === "final" || day === 90) return "Day 90 · Final report";
  if (kind === "month") {
    return day === 30 ? "Day 30 · Month 1 report" : "Day 60 · Month 2 report";
  }
  return `Day ${day} · 15-day review`;
}
