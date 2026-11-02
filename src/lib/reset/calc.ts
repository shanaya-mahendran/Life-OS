/**
 * Pure Reset Plan calculations.
 *
 * Kept free of Prisma and React so the numbers in the plan, the reports and
 * the Habit Tracker all come from one place — and can be tested directly.
 */

import { addZonedDays, startOfZonedDay } from "@/lib/time";
import { RESET_DAYS, RESET_PHASES, REVIEW_DAYS, STARTER_ANCHORS, type ResetPhaseConfig } from "./constants";

export interface CommitmentLike {
  id: string;
  title: string;
  kind: string;
  phase: number;
  status: string;
  cadence: string;
  createdAt?: Date;
}

export interface CheckinLike {
  commitmentId: string;
  dateKey: string;
  result: string;
}

export interface ReviewPeriod {
  day: number;
  kind: "review15" | "month" | "final";
  periodStartDay: number;
  periodEndDay: number;
  label: string;
  shortLabel: string;
}

/* -------------------------------------------------------------------------- */
/* Dates and plan days                                                         */
/* -------------------------------------------------------------------------- */

export function keyToUtcDate(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function addKeyDays(key: string, days: number): string {
  const date = keyToUtcDate(key);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function dayKeysBetween(startKey: string, endKey: string, guard = 400): string[] {
  const keys: string[] = [];
  let cursor = startKey;
  let count = 0;
  while (cursor <= endKey && count < guard) {
    keys.push(cursor);
    cursor = addKeyDays(cursor, 1);
    count += 1;
  }
  return keys;
}

export function recentDayKeys(todayKey: string, days: number): string[] {
  return Array.from({ length: days }, (_, index) => addKeyDays(todayKey, index - days + 1));
}

export function planDayNumber(startedAt: Date | null | undefined, now: Date, timeZone: string): number {
  if (!startedAt) return 0;
  const start = startOfZonedDay(startedAt, timeZone).getTime();
  const today = startOfZonedDay(now, timeZone).getTime();
  const days = Math.round((today - start) / 86_400_000) + 1;
  return Math.max(0, Math.min(RESET_DAYS, days));
}

export function planDayDate(startedAt: Date, dayNumber: number, timeZone: string): Date {
  const start = startOfZonedDay(startedAt, timeZone);
  return addZonedDays(start, dayNumber - 1, timeZone);
}

export function planEndDate(startedAt: Date, timeZone: string): Date {
  return addZonedDays(startOfZonedDay(startedAt, timeZone), RESET_DAYS, timeZone);
}

export function phaseForPlanDay(day: number): ResetPhaseConfig {
  if (day <= 0) return RESET_PHASES[0];
  if (day <= 30) return RESET_PHASES[0];
  if (day <= 60) return RESET_PHASES[1];
  return RESET_PHASES[2];
}

export function phaseNumberForPlanDay(day: number): 1 | 2 | 3 {
  return phaseForPlanDay(day).phase;
}

export function progressPercent(day: number): number {
  return Math.max(0, Math.min(100, Math.round((day / RESET_DAYS) * 100)));
}

/* -------------------------------------------------------------------------- */
/* Review schedule                                                             */
/* -------------------------------------------------------------------------- */

const PERIODS: Record<number, { kind: ReviewPeriod["kind"]; start: number; end: number }> = {
  15: { kind: "review15", start: 1, end: 15 },
  30: { kind: "month", start: 1, end: 30 },
  45: { kind: "review15", start: 31, end: 45 },
  60: { kind: "month", start: 31, end: 60 },
  75: { kind: "review15", start: 61, end: 75 },
  90: { kind: "final", start: 61, end: 90 },
};

export function reviewPeriod(day: number): ReviewPeriod {
  const entry = PERIODS[day] ?? PERIODS[15];
  const shortLabel =
    entry.kind === "month"
      ? `Month ${day / 30}`
      : entry.kind === "final"
        ? "Final"
        : `Day ${day}`;
  const label =
    entry.kind === "month"
      ? `Day ${day} · Month ${day / 30} report`
      : entry.kind === "final"
        ? "Day 90 · Final report"
        : `Day ${day} · 15-day review`;
  return {
    day,
    kind: entry.kind,
    periodStartDay: entry.start,
    periodEndDay: entry.end,
    label,
    shortLabel,
  };
}

export const ALL_REVIEW_PERIODS: ReviewPeriod[] = REVIEW_DAYS.map((day) => reviewPeriod(day));

export function dueReviewPeriods(currentDay: number): ReviewPeriod[] {
  return ALL_REVIEW_PERIODS.filter((period) => period.day <= currentDay);
}

export function nextReviewPeriod(currentDay: number): ReviewPeriod | null {
  const next = REVIEW_DAYS.find((day) => day > currentDay);
  return next ? reviewPeriod(next) : null;
}

export function latestDueReviewPeriod(currentDay: number): ReviewPeriod | null {
  const due = dueReviewPeriods(currentDay);
  return due.length ? due[due.length - 1] : null;
}

/* -------------------------------------------------------------------------- */
/* Adherence and streaks                                                       */
/* -------------------------------------------------------------------------- */

export function notebookComplete(
  notebook: { q1: string; q2: string; q3: string; skipped: boolean } | null | undefined,
): boolean {
  if (!notebook) return false;
  if (notebook.skipped) return true;
  return Boolean(notebook.q1.trim() && notebook.q2.trim() && notebook.q3.trim());
}

export function calculateAdherence(records: { result: string }[]) {
  const done = records.filter((record) => record.result === "done").length;
  const skipped = records.filter((record) => record.result === "skipped").length;
  const missed = records.filter((record) => record.result === "missed").length;
  const total = done + skipped + missed;
  return {
    done,
    skipped,
    missed,
    total,
    adherence: total ? Math.round((done / total) * 100) : 0,
  };
}

export function currentStreak(doneKeys: string[], todayKey: string): number {
  const set = new Set(doneKeys);
  let cursor = set.has(todayKey) ? todayKey : addKeyDays(todayKey, -1);
  if (!set.has(cursor)) return 0;
  let count = 0;
  while (set.has(cursor) && count < 4000) {
    count += 1;
    cursor = addKeyDays(cursor, -1);
  }
  return count;
}

export function longestStreak(doneKeys: string[]): number {
  const unique = [...new Set(doneKeys)].sort();
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const key of unique) {
    run = previous && addKeyDays(previous, 1) === key ? run + 1 : 1;
    best = Math.max(best, run);
    previous = key;
  }
  return best;
}

export interface CommitmentStat {
  commitmentId: string;
  title: string;
  kind: string;
  phase: number;
  cadence: string;
  done: number;
  skipped: number;
  missed: number;
  total: number;
  adherence: number;
  streak: number;
  longest: number;
  recent: { dateKey: string; result: string | null }[];
}

export function commitmentStats(
  commitments: CommitmentLike[],
  records: CheckinLike[],
  todayKey: string,
  windowDays = 15,
): CommitmentStat[] {
  const window = recentDayKeys(todayKey, windowDays);
  const windowSet = new Set(window);
  return commitments.map((commitment) => {
    const own = records.filter((record) => record.commitmentId === commitment.id);
    const inWindow = own.filter((record) => windowSet.has(record.dateKey));
    const stats = calculateAdherence(inWindow);
    const doneKeys = own.filter((record) => record.result === "done").map((record) => record.dateKey);
    const recent = window.map((dateKey) => ({
      dateKey,
      result: own.find((record) => record.dateKey === dateKey)?.result ?? null,
    }));
    return {
      commitmentId: commitment.id,
      title: commitment.title,
      kind: commitment.kind,
      phase: commitment.phase,
      cadence: commitment.cadence,
      ...stats,
      streak: currentStreak(doneKeys, todayKey),
      longest: longestStreak(doneKeys),
      recent,
    };
  });
}

export function bestAndMostMissed(stats: CommitmentStat[]) {
  const rated = stats.filter((stat) => stat.total > 0);
  const best = [...rated].sort((a, b) => b.adherence - a.adherence || b.done - a.done)[0] ?? null;
  const mostMissed = [...rated].sort((a, b) => b.missed - a.missed || a.adherence - b.adherence)[0] ?? null;
  return { best, mostMissed };
}

export function planStreak(records: CheckinLike[], todayKey: string): number {
  const byDay = new Map<string, { done: boolean; missed: boolean }>();
  for (const record of records) {
    const entry = byDay.get(record.dateKey) ?? { done: false, missed: false };
    if (record.result === "done") entry.done = true;
    if (record.result === "missed") entry.missed = true;
    byDay.set(record.dateKey, entry);
  }
  const goodDays = [...byDay.entries()]
    .filter(([, entry]) => entry.done && !entry.missed)
    .map(([key]) => key);
  return currentStreak(goodDays, todayKey);
}

/* -------------------------------------------------------------------------- */
/* Drift                                                                       */
/* -------------------------------------------------------------------------- */

export interface DriftSuggestion {
  commitmentId: string;
  title: string;
  reason: "three_misses" | "low_adherence";
  message: string;
  detail: string;
}

export function detectDrift(
  commitments: CommitmentLike[],
  records: CheckinLike[],
  todayKey: string,
): DriftSuggestion[] {
  const last3 = recentDayKeys(todayKey, 3);
  const last7 = recentDayKeys(todayKey, 7);
  const suggestions: DriftSuggestion[] = [];

  for (const commitment of commitments) {
    const own = records.filter((record) => record.commitmentId === commitment.id);
    const three = last3.map((key) => own.find((record) => record.dateKey === key));
    if (three.every((entry) => entry?.result === "missed")) {
      suggestions.push({
        commitmentId: commitment.id,
        title: commitment.title,
        reason: "three_misses",
        message: `“${commitment.title}” has been missed three days in a row.`,
        detail: "Move it to tomorrow, drop it for this week, or switch to a lighter pace.",
      });
      continue;
    }

    const seven = own.filter((record) => last7.includes(record.dateKey));
    if (seven.length >= 3) {
      const stats = calculateAdherence(seven);
      if (stats.adherence < 50) {
        suggestions.push({
          commitmentId: commitment.id,
          title: commitment.title,
          reason: "low_adherence",
          message: `“${commitment.title}” is at ${stats.adherence}% over the last seven days.`,
          detail: "Shrink the target, move the block, or drop it for this week.",
        });
      }
    }
  }

  return suggestions.slice(0, 3);
}

/* -------------------------------------------------------------------------- */
/* Goals                                                                       */
/* -------------------------------------------------------------------------- */

export function goalPercent(value: number | null | undefined, target: number): number {
  if (!target || target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(((value ?? 0) / target) * 100)));
}

export function goalAverage(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/* -------------------------------------------------------------------------- */
/* Gap report                                                                  */
/* -------------------------------------------------------------------------- */

export interface GapReportDraft {
  generatedAt: string;
  currentQuote: string;
  targetQuote: string;
  patternQuote: string;
  summary: string;
  patterns: string[];
  topGaps: { label: string; evidence: string }[];
  cutCandidates: string[];
  anchorCandidates: string[];
  recommendedFocus: string;
  notes: string;
}

const FOCUS_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: "Sleep and recovery", pattern: /sleep|wake|tired|rest|energy|insomnia|bedtime|night/i },
  { label: "Career focus", pattern: /work|job|career|office|internship|manager|client/i },
  { label: "Studies and exams", pattern: /study|college|exam|assignment|lecture|university|course/i },
  { label: "Money habits", pattern: /money|finance|spend|budget|save|saving|debt|expense/i },
  { label: "Attention and screen time", pattern: /phone|scroll|instagram|social media|youtube|screen|distract/i },
  { label: "Health and movement", pattern: /health|gym|train|karate|run|body|movement|exercise/i },
  { label: "Relationships", pattern: /family|friend|mentor|relationship|partner|parents|people/i },
  { label: "Time and follow-through", pattern: /time|late|procrastinat|deadline|start|finish|routine/i },
  { label: "Focus", pattern: /focus|deep work|concentrat|attention/i },
];

function sentences(value: string): string[] {
  return value
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 12);
}

export function shortQuote(value: string, max = 180): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 60 ? lastSpace : max).trim()}…`;
}

export function buildGapDraft(
  answers: { step: number; answer: string }[],
  options: { checkinTime: string },
): GapReportDraft {
  const current = answers.find((answer) => answer.step === 1)?.answer ?? "";
  const target = answers.find((answer) => answer.step === 2)?.answer ?? "";
  const pattern = answers.find((answer) => answer.step === 3)?.answer ?? "";
  const combined = `${current} ${target} ${pattern}`;

  const focusMatches = FOCUS_PATTERNS.map((entry) => {
    const match = combined.match(entry.pattern);
    if (!match) return null;
    const evidence =
      sentences(current).find((sentence) => entry.pattern.test(sentence)) ??
      sentences(target).find((sentence) => entry.pattern.test(sentence)) ??
      "";
    return {
      label: entry.label,
      evidence: shortQuote(evidence, 150),
      score: (combined.match(new RegExp(entry.pattern.source, "gi")) ?? []).length,
    };
  })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const topGaps = focusMatches.length
    ? focusMatches.map(({ label, evidence }) => ({ label, evidence }))
    : [
        { label: "Consistency", evidence: "The pattern you described points at starting again more than starting over." },
        { label: "Energy", evidence: "Your mornings and your sleep came up in the audit." },
        { label: "Focus", evidence: "You named what pulls your attention away." },
      ];

  const cutCandidates = new Set<string>();
  if (/scroll|phone|instagram|social media|youtube/i.test(combined)) cutCandidates.add("Scrolling after 22:00");
  if (/late|midnight|night owl|sleep late|bedtime/i.test(combined)) cutCandidates.add("Late nights");
  if (/takeaway|delivery|order food|skip.*meal|eat out/i.test(combined)) cutCandidates.add("Ordering food when tired");
  if (/spend|shopping|impulse|budget/i.test(combined)) cutCandidates.add("Unplanned spending");
  if (!cutCandidates.size) cutCandidates.add("One thing that drains an hour a day");
  cutCandidates.add("Starting the day without a plan");

  const anchorCandidates = [...STARTER_ANCHORS, `Evening check-in at ${options.checkinTime}`];

  return {
    generatedAt: new Date().toISOString(),
    currentQuote: shortQuote(current, 320),
    targetQuote: shortQuote(target, 320),
    patternQuote: shortQuote(pattern, 320),
    summary: `You start here: “${shortQuote(current, 220)}” In 90 days you want: “${shortQuote(target, 220)}”`,
    patterns: sentences(pattern).slice(0, 3),
    topGaps,
    cutCandidates: [...cutCandidates].slice(0, 4),
    anchorCandidates,
    recommendedFocus: topGaps[0]?.label ?? "Consistency",
    notes: "Every line is editable. The agent quotes your words; it never adds facts about your life.",
  };
}

export function gapReportSummary(report: Record<string, unknown> | null | undefined): string {
  if (!report) return "";
  const summary = report.summary;
  return typeof summary === "string" ? summary : "";
}

/* -------------------------------------------------------------------------- */
/* Agent summary                                                               */
/* -------------------------------------------------------------------------- */

export function buildAgentSummary(input: {
  noteQuote?: string;
  changeQuote?: string;
  adherence: number;
  done: number;
  missed: number;
  best?: string | null;
  mostMissed?: string | null;
  goals?: { title: string; current: number; target: number; unit: string }[];
  kind: "review15" | "month" | "final";
}): string {
  const lines: string[] = [];
  const quote = input.noteQuote?.trim();
  if (quote) {
    lines.push(`In your words: “${shortQuote(quote, 220)}”`);
  }

  lines.push(
    `You checked in ${input.done} time${input.done === 1 ? "" : "s"} as done and recorded ${input.missed} miss${
      input.missed === 1 ? "" : "es"
    } in this period. The check-in rate is ${input.adherence}%.`,
  );

  if (input.best) lines.push(`Your steadiest commitment was “${input.best}”.`);
  if (input.mostMissed) lines.push(`The one that needed the most room was “${input.mostMissed}”.`);

  if (input.goals?.length) {
    const goalLine = input.goals
      .map((goal) => `${goal.title} (${goal.current}${goal.unit ? ` ${goal.unit}` : ""} of ${goal.target}${goal.unit ? ` ${goal.unit}` : ""})`)
      .join("; ");
    lines.push(`Goal progress: ${goalLine}.`);
  }

  const change = input.changeQuote?.trim();
  if (change) {
    lines.push(`Your next change, in your own words: “${shortQuote(change, 200)}”`);
  }

  if (input.kind === "final") {
    lines.push("This is the closing picture for the 90 days. Keep what worked; leave the rest here.");
  }

  return lines.join(" ");
}
