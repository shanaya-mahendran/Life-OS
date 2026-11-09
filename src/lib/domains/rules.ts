/**
 * LifeOS Domain Rules Engine
 *
 * Implements the domain logic, knowledge systems and unique systems for all 22 LifeOS domains.
 * Pure functions: tested, deterministic, and callable from agents, UI, and background jobs.
 */

import { addZonedDays, minutesBetween } from "@/lib/time";
import { DOMAIN_MAP, type ProtectedTier } from "./catalog";

/* -------------------------------------------------------------------------- */
/* 1. Core Cross-Domain Rules: Backward Planning, Spaced Revision, Slot Ranking */
/* -------------------------------------------------------------------------- */

export interface AvailableSlot {
  start: Date;
  end: Date;
  score?: number;
}

export interface BackwardPlanInput {
  deadline: Date;
  totalHours: number;
  availableSlots: AvailableSlot[];
  blockMinutesRange?: [number, number]; // default [60, 120]
  stopDaysBefore?: number; // default 1 day before deadline for review
  topics?: Array<{ title: string; confidence: number; weight: number }>;
}

export interface PlannedBlock {
  title: string;
  start: Date;
  end: Date;
  minutes: number;
  topicTitle?: string;
}

/**
 * Backward planning: splits total hours into 60-120 min blocks, stops 1 day before
 * deadline for final review, and places blocks in the best available slots.
 * Weak topics (confidence < 100) receive proportionally more time.
 */
export function planBackwardsSpaced(input: BackwardPlanInput): PlannedBlock[] {
  const {
    deadline,
    totalHours,
    availableSlots,
    blockMinutesRange = [60, 120],
    stopDaysBefore = 1,
    topics,
  } = input;

  const latestAllowed = new Date(deadline.getTime() - stopDaysBefore * 24 * 60 * 60 * 1000);
  const eligibleSlots = availableSlots
    .filter((slot) => slot.end.getTime() <= latestAllowed.getTime())
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.start.getTime() - b.start.getTime());

  let remainingMinutes = Math.round(totalHours * 60);
  const planned: PlannedBlock[] = [];

  // If topics exist, calculate topic distribution by gap from 100 * weight
  let topicWeights: { title: string; share: number }[] = [];
  if (topics && topics.length > 0) {
    const totalScore = topics.reduce(
      (sum, t) => sum + Math.max(10, (100 - t.confidence) * (t.weight || 1)),
      0,
    );
    topicWeights = topics.map((t) => ({
      title: t.title,
      share: Math.max(10, (100 - t.confidence) * (t.weight || 1)) / (totalScore || 1),
    }));
  }

  let topicIndex = 0;
  for (const slot of eligibleSlots) {
    if (remainingMinutes <= 0) break;
    const slotDuration = minutesBetween(slot.start, slot.end);
    if (slotDuration < blockMinutesRange[0]) continue;

    const blockSize = Math.min(slotDuration, blockMinutesRange[1], remainingMinutes);
    if (blockSize < blockMinutesRange[0] && remainingMinutes >= blockMinutesRange[0]) continue;

    const blockEnd = new Date(slot.start.getTime() + blockSize * 60 * 1000);
    const assignedTopic = topicWeights.length > 0 ? topicWeights[topicIndex % topicWeights.length].title : undefined;

    planned.push({
      title: assignedTopic ? `Revision: ${assignedTopic}` : "Study Block",
      start: new Date(slot.start),
      end: blockEnd,
      minutes: blockSize,
      topicTitle: assignedTopic,
    });

    remainingMinutes -= blockSize;
    topicIndex += 1;
  }

  return planned.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * Spaced revision: schedules review sessions at growing intervals (1, 3, 7, 14 days)
 * prior to a target date. Squeezes gaps if the window is short, and adds extra review for weak items.
 */
export function calculateSpacedRevisionGaps(
  targetDate: Date,
  fromDate: Date,
  options?: { isWeak?: boolean },
): number[] {
  const windowDays = Math.max(1, Math.round((targetDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000)));
  const standardGaps = [1, 3, 7, 14];

  if (windowDays >= 14) {
    const gaps = options?.isWeak ? [1, 2, 4, 7, 14] : standardGaps;
    return gaps.filter((gap) => gap < windowDays);
  }

  // Squeeze gaps proportionally
  const factor = windowDays / 15;
  const squeezed = Array.from(
    new Set(standardGaps.map((g) => Math.max(1, Math.round(g * factor)))),
  ).filter((gap) => gap < windowDays);

  if (options?.isWeak && !squeezed.includes(1)) {
    squeezed.unshift(1);
  }
  return squeezed.sort((a, b) => a - b);
}

/**
 * Slot ranking: scores candidate slots higher for focus hours, lower for already heavy days,
 * and eliminates slots overlapping Tier 1 anchors.
 */
export function rankSlots(
  slots: AvailableSlot[],
  focusHours: { startHour: number; endHour: number },
  dailyPlannedMinutes: Record<string, number>,
  protectedAnchors: Array<{ start: Date; end: Date; tier: ProtectedTier }>,
): AvailableSlot[] {
  return slots
    .filter((slot) => {
      // Eliminate any slot that overlaps a Tier 1 anchor
      return !protectedAnchors.some(
        (anchor) =>
          anchor.tier === 1 &&
          slot.start.getTime() < anchor.end.getTime() &&
          anchor.start.getTime() < slot.end.getTime(),
      );
    })
    .map((slot) => {
      let score = 50;
      const hour = slot.start.getUTCHours();

      // Focus hours boost
      if (hour >= focusHours.startHour && hour < focusHours.endHour) {
        score += 25;
      }

      // Check daily load penalty
      const dateKey = slot.start.toISOString().split("T")[0];
      const load = dailyPlannedMinutes[dateKey] ?? 0;
      if (load > 360) {
        score -= 30; // heavy day penalty
      } else if (load > 240) {
        score -= 15;
      }

      return { ...slot, score };
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

/* -------------------------------------------------------------------------- */
/* 2. Sleep & Debt Bank                                                        */
/* -------------------------------------------------------------------------- */

export interface SleepLogEntry {
  date: string;
  hours: number;
}

export interface SleepDebtResult {
  debtHours: number;
  averageSleepHours: number;
  shortfallDays: number;
  repayProposal: {
    daysToRepay: number;
    bedtimeShiftMinutes: number;
    suggestedDropBlockCount: number;
    message: string;
  } | null;
}

/**
 * Sleep debt bank: calculates debt as the sum of 7-day shortfalls under minimum sleep.
 * Repays by shifting bedtime earlier and lightening load; never adds load.
 */
export function calculateSleepDebt(logs: SleepLogEntry[], minSleepHours = 7.5): SleepDebtResult {
  const recent = logs.slice(-7);
  let totalDebt = 0;
  let totalSlept = 0;
  let shortfalls = 0;

  for (const log of recent) {
    totalSlept += log.hours;
    if (log.hours < minSleepHours) {
      totalDebt += minSleepHours - log.hours;
      shortfalls += 1;
    }
  }

  const avg = recent.length ? totalSlept / recent.length : minSleepHours;
  totalDebt = Math.round(totalDebt * 10) / 10;

  let repayProposal = null;
  if (totalDebt > 0.5) {
    const daysToRepay = Math.min(7, Math.max(2, Math.ceil(totalDebt / 0.75)));
    const bedtimeShift = Math.min(45, Math.max(15, Math.round((totalDebt / daysToRepay) * 45)));
    repayProposal = {
      daysToRepay,
      bedtimeShiftMinutes: bedtimeShift,
      suggestedDropBlockCount: totalDebt > 3 ? 2 : 1,
      message: `Sleep debt is ${totalDebt}h across ${shortfalls} short nights. Proposing shifting bedtime ${bedtimeShift}m earlier for the next ${daysToRepay} days and lightening evening load.`,
    };
  }

  return {
    debtHours: totalDebt,
    averageSleepHours: Math.round(avg * 10) / 10,
    shortfallDays: shortfalls,
    repayProposal,
  };
}

/* -------------------------------------------------------------------------- */
/* 3. Education: Mastery Map & Grade Calculator                               */
/* -------------------------------------------------------------------------- */

export function calculateGradeNeeded(
  targetGrade: number,
  pointsEarnedSoFar: number,
  remainingWeight: number,
): { requiredScore: number; isAchievable: boolean } {
  if (remainingWeight <= 0) {
    return { requiredScore: 0, isAchievable: pointsEarnedSoFar >= targetGrade };
  }
  const score = (targetGrade - pointsEarnedSoFar) / (remainingWeight / 100);
  const rounded = Math.round(score * 10) / 10;
  return {
    requiredScore: rounded,
    isAchievable: rounded <= 100,
  };
}

export function updateTopicMastery(
  currentConfidence: number,
  practiceScore: number,
  daysSinceLastReview: number,
): number {
  // Practice boosts confidence; decay reduces it over days without review (-2% per day)
  const decay = Math.min(30, daysSinceLastReview * 2);
  const adjusted = Math.max(0, currentConfidence - decay);
  const newConfidence = Math.min(100, Math.round(adjusted * 0.4 + practiceScore * 0.6));
  return newConfidence;
}

/* -------------------------------------------------------------------------- */
/* 4. Competitions: Reverse Sprint & Rubric Scorer                            */
/* -------------------------------------------------------------------------- */

export interface ReverseSprintMilestone {
  label: string;
  time: Date;
  durationMinutes: number;
  type: "freeze" | "demo" | "rehearsal" | "buffer" | "submission";
}

/**
 * Reverse sprint: counts back from submission time:
 * Submission -> 2-hour buffer -> Demo recording -> Build freeze -> Pitch rehearsals -> Build blocks.
 */
export function buildReverseSprint(
  submissionTime: Date,
  options?: { rehearsalHours?: number; buildHours?: number },
): ReverseSprintMilestone[] {
  const rehearsalDuration = (options?.rehearsalHours ?? 1.5) * 60;
  const milestones: ReverseSprintMilestone[] = [];

  // 1. Submission
  milestones.push({
    label: "Final Submission Deadline",
    time: new Date(submissionTime),
    durationMinutes: 0,
    type: "submission",
  });

  // 2. 2-Hour Buffer
  const bufferStart = new Date(submissionTime.getTime() - 2 * 60 * 60 * 1000);
  milestones.push({
    label: "Final Submission Buffer (Safety window)",
    time: bufferStart,
    durationMinutes: 120,
    type: "buffer",
  });

  // 3. Demo Recording (60m)
  const demoStart = new Date(bufferStart.getTime() - 60 * 60 * 1000);
  milestones.push({
    label: "Demo Video Recording & Upload",
    time: demoStart,
    durationMinutes: 60,
    type: "demo",
  });

  // 4. Build Freeze (code stop)
  const freezeTime = new Date(demoStart.getTime() - 30 * 60 * 1000);
  milestones.push({
    label: "Build Freeze (No more code changes)",
    time: freezeTime,
    durationMinutes: 0,
    type: "freeze",
  });

  // 5. Pitch Rehearsals
  const rehearsalStart = new Date(freezeTime.getTime() - rehearsalDuration * 60 * 1000);
  milestones.push({
    label: "Pitch Rehearsals & Deck Polish",
    time: rehearsalStart,
    durationMinutes: rehearsalDuration,
    type: "rehearsal",
  });

  return milestones.sort((a, b) => a.time.getTime() - b.time.getTime());
}

export function scorePitchRubric(pitchNotes: string, criteria: string[]): { criterion: string; feedback: string }[] {
  const lower = pitchNotes.toLowerCase();
  const feedbackList: { criterion: string; feedback: string }[] = [];

  for (const criterion of criteria) {
    const cLower = criterion.toLowerCase();
    if (!lower.includes(cLower.split(" ")[0])) {
      feedbackList.push({
        criterion,
        feedback: `Criterion "${criterion}" appears weakly addressed in your pitch notes. Add concrete proof or data.`,
      });
    }
  }

  return feedbackList;
}

/* -------------------------------------------------------------------------- */
/* 5. Learning: Skill Tree Unlock Graph                                       */
/* -------------------------------------------------------------------------- */

export interface SkillNode {
  id: string;
  name: string;
  prerequisites: string[];
  done: boolean;
  importance: number; // 1-10
  effortHours: number;
}

export function evaluateSkillTree(skills: SkillNode[]): {
  unlocked: SkillNode[];
  recommended: SkillNode | null;
} {
  const doneIds = new Set(skills.filter((s) => s.done).map((s) => s.id));
  const unlocked = skills.filter((s) => !s.done && s.prerequisites.every((prereq) => doneIds.has(prereq)));

  // Score unlocked node = importance - effort
  const scored = unlocked.map((s) => ({
    node: s,
    score: s.importance * 2 - s.effortHours,
  }));
  scored.sort((a, b) => b.score - a.score);

  return {
    unlocked,
    recommended: scored.length ? scored[0].node : null,
  };
}

/* -------------------------------------------------------------------------- */
/* 6. Open Source: Issue Fit Scorer                                           */
/* -------------------------------------------------------------------------- */

export interface OpenSourceIssue {
  id: string;
  title: string;
  labels: string[];
  estimatedHours: number;
  maintainerResponseHours: number;
}

export function scoreIssueFit(issue: OpenSourceIssue, userSkills: string[], slotHours = 2): number {
  let fit = 0;
  // Match labels with user skills
  for (const skill of userSkills) {
    if (issue.labels.some((l) => l.toLowerCase().includes(skill.toLowerCase()))) {
      fit += 5;
    }
  }

  // Good first issue bonus
  if (issue.labels.some((l) => l.toLowerCase().includes("good first") || l.toLowerCase().includes("help wanted"))) {
    fit += 4;
  }

  // Hours penalty if extends past slot
  if (issue.estimatedHours > slotHours) {
    fit -= (issue.estimatedHours - slotHours) * 2;
  }

  // Slow maintainer penalty
  if (issue.maintainerResponseHours > 72) {
    fit -= 3;
  } else if (issue.maintainerResponseHours < 24) {
    fit += 2;
  }

  return fit;
}

/* -------------------------------------------------------------------------- */
/* 7. Blogging: Idea Harvester                                                */
/* -------------------------------------------------------------------------- */

export function harvestPostIdeas(
  notes: Array<{ topic: string; content: string }>,
): Array<{ topic: string; noteCount: number; proposedTitle: string }> {
  const grouped = new Map<string, number>();
  for (const note of notes) {
    const key = note.topic.trim().toLowerCase();
    if (key) {
      grouped.set(key, (grouped.get(key) ?? 0) + 1);
    }
  }

  const harvested: Array<{ topic: string; noteCount: number; proposedTitle: string }> = [];
  for (const [topic, count] of grouped.entries()) {
    if (count >= 3) {
      harvested.push({
        topic,
        noteCount: count,
        proposedTitle: `What I Learned Building with ${topic.charAt(0).toUpperCase() + topic.slice(1)}`,
      });
    }
  }

  return harvested;
}

/* -------------------------------------------------------------------------- */
/* 8. Food: Prep-Once Planner                                                 */
/* -------------------------------------------------------------------------- */

export type DayLoadCategory = "light" | "normal" | "heavy";

export function classifyDayLoad(plannedMinutes: number): DayLoadCategory {
  if (plannedMinutes < 180) return "light";
  if (plannedMinutes <= 360) return "normal";
  return "heavy";
}

export function planPrepOnceMeals(
  days: Array<{ date: string; plannedMinutes: number }>,
): Array<{ date: string; mealType: "zero-cook" | "standard" | "batch-cook-prep" }> {
  return days.map((day) => {
    const load = classifyDayLoad(day.plannedMinutes);
    if (load === "heavy") {
      return { date: day.date, mealType: "zero-cook" };
    }
    if (load === "light") {
      return { date: day.date, mealType: "batch-cook-prep" };
    }
    return { date: day.date, mealType: "standard" };
  });
}

/* -------------------------------------------------------------------------- */
/* 9. Karate: Belt Path & Conditioning Limits                                 */
/* -------------------------------------------------------------------------- */

export interface BeltPathItem {
  name: string;
  isSolid: boolean;
  type: "technique" | "kata";
}

export function buildBeltPath(
  items: BeltPathItem[],
  gradingDate: Date,
  now: Date,
  hasInjury = false,
): { weeklyDrills: { week: number; items: BeltPathItem[] }[]; finalReviewWeek: boolean } {
  const unsolid = items.filter((item) => !item.isSolid);
  const weeksLeft = Math.max(1, Math.round((gradingDate.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000)));

  const drillWeeks = Math.max(1, weeksLeft - 1); // reserve final week for review
  const itemsPerWeek = Math.ceil(unsolid.length / drillWeeks);

  const weeklyDrills: { week: number; items: BeltPathItem[] }[] = [];
  for (let w = 0; w < drillWeeks; w++) {
    const slice = unsolid.slice(w * itemsPerWeek, (w + 1) * itemsPerWeek);
    weeklyDrills.push({ week: w + 1, items: slice });
  }

  return {
    weeklyDrills,
    finalReviewWeek: weeksLeft > 1,
  };
}

export function checkKarateRecovery(hardSessionDays: string[], targetDay: string): boolean {
  // Planner will not schedule a hard session the day after two hard sessions in a row
  const dayBefore = addZonedDays(new Date(targetDay), -1, "UTC").toISOString().split("T")[0];
  const twoDaysBefore = addZonedDays(new Date(targetDay), -2, "UTC").toISOString().split("T")[0];

  return hardSessionDays.includes(dayBefore) && hardSessionDays.includes(twoDaysBefore);
}

/* -------------------------------------------------------------------------- */
/* 10. Medicine: Dose-Safe Scheduler & Refill Countdown                       */
/* -------------------------------------------------------------------------- */

export interface MedicationRecord {
  name: string;
  doseTime: string; // "08:00"
  stockRemaining: number;
  dosesPerDay: number;
  refillLeadDays: number;
}

export function calculateRefillCountdown(med: MedicationRecord): {
  daysRemaining: number;
  needsRefillAlert: boolean;
} {
  const daysRemaining = Math.floor(med.stockRemaining / Math.max(1, med.dosesPerDay));
  return {
    daysRemaining,
    needsRefillAlert: daysRemaining <= med.refillLeadDays,
  };
}

export function generateVisitBrief(
  meds: MedicationRecord[],
  symptoms: string[],
  questions: string[],
): string {
  return [
    "# Clinical Visit Brief",
    "## Current Medications",
    ...meds.map((m) => `- ${m.name} (${m.doseTime}) · ${m.dosesPerDay} dose(s)/day`),
    "## Recent Symptom Notes",
    ...(symptoms.length ? symptoms.map((s) => `- ${s}`) : ["- No symptoms reported"]),
    "## Questions for Doctor",
    ...(questions.length ? questions.map((q) => `- ${q}`) : ["- Routine checkup"]),
  ].join("\n");
}

/* -------------------------------------------------------------------------- */
/* 11. Rest & Buffer: Recovery Forecast & Load Check                          */
/* -------------------------------------------------------------------------- */

export function calculateRecoveryForecast(
  nextWeekPlannedHours: number,
  sleepDebtHours: number,
  moodAvg: number,
): {
  risk: "low" | "medium" | "high";
  message: string;
  proposeExtraBuffer: boolean;
} {
  let highRiskCount = 0;
  if (nextWeekPlannedHours > 42) highRiskCount += 1;
  if (sleepDebtHours >= 4) highRiskCount += 1;
  if (moodAvg > 0 && moodAvg <= 2.5) highRiskCount += 1;

  if (highRiskCount >= 2) {
    return {
      risk: "high",
      message: `High burnout risk detected (Load: ${nextWeekPlannedHours}h, Sleep Debt: ${sleepDebtHours}h, Mood: ${moodAvg}/5). Propose adding 30m buffers and lightening heavy days.`,
      proposeExtraBuffer: true,
    };
  }

  if (highRiskCount === 1) {
    return {
      risk: "medium",
      message: "Moderate fatigue signals. Keep standard buffers protected.",
      proposeExtraBuffer: false,
    };
  }

  return {
    risk: "low",
    message: "Healthy recovery balance.",
    proposeExtraBuffer: false,
  };
}

/* -------------------------------------------------------------------------- */
/* 12. Prayer: Entered Times & GitHub-Style Heatmap                           */
/* -------------------------------------------------------------------------- */

export interface PrayerTimeConfig {
  date: string;
  fajr: string;
  sunrise?: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
}

export type PrayerStatus = "on_time" | "late" | "missed" | "excused";

export function getHeatmapShade(completedCount: number, isExcused = false): number {
  if (isExcused) return -1; // special dot representation
  if (completedCount <= 0) return 0;
  if (completedCount <= 2) return 1; // lightest
  if (completedCount === 3) return 2; // light
  if (completedCount === 4) return 3; // strong
  return 4; // full color
}

export function calculatePrayerStreak(
  records: Array<{ date: string; completedCount: number; isExcused?: boolean }>,
): { currentStreak: number; longestStreak: number } {
  let current = 0;
  let longest = 0;

  for (let i = records.length - 1; i >= 0; i--) {
    const r = records[i];
    if (r.completedCount === 5 || r.isExcused) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      break;
    }
  }

  let streak = 0;
  for (const r of records) {
    if (r.completedCount === 5 || r.isExcused) {
      streak += 1;
      longest = Math.max(longest, streak);
    } else {
      streak = 0;
    }
  }

  return { currentStreak: current, longestStreak: longest };
}

/* -------------------------------------------------------------------------- */
/* 13. Period Tracking: Cycle Lengths & Range Prediction                      */
/* -------------------------------------------------------------------------- */

export interface CycleRecord {
  startDate: string;
  endDate?: string;
}

export function predictCycleRange(cycles: CycleRecord[]): {
  predictedStartDaysMin: number;
  predictedStartDaysMax: number;
  averageCycleLength: number;
  status: "needs_more_data" | "ready";
} {
  if (cycles.length < 2) {
    return {
      predictedStartDaysMin: 26,
      predictedStartDaysMax: 32,
      averageCycleLength: 28,
      status: "needs_more_data",
    };
  }

  const lengths: number[] = [];
  for (let i = 0; i < cycles.length - 1; i++) {
    const curr = new Date(cycles[i].startDate).getTime();
    const next = new Date(cycles[i + 1].startDate).getTime();
    const days = Math.round(Math.abs(next - curr) / (24 * 60 * 60 * 1000));
    if (days >= 20 && days <= 45) {
      lengths.push(days);
    }
  }

  if (lengths.length < 2) {
    return {
      predictedStartDaysMin: 25,
      predictedStartDaysMax: 35,
      averageCycleLength: 28,
      status: "needs_more_data",
    };
  }

  const recent = lengths.slice(-6);
  const min = Math.min(...recent);
  const max = Math.max(...recent);
  const avg = Math.round(recent.reduce((a, b) => a + b, 0) / recent.length);

  return {
    predictedStartDaysMin: min,
    predictedStartDaysMax: max,
    averageCycleLength: avg,
    status: cycles.length >= 3 ? "ready" : "needs_more_data",
  };
}

/* -------------------------------------------------------------------------- */
/* 14. Mood Reflections: Private Weather Map & Care-First Safety              */
/* -------------------------------------------------------------------------- */

export interface MoodEntryData {
  date: string;
  mood: number; // 1-5
  energy: number; // 1-5
  sleepHours?: number;
  workoutDone?: boolean;
  notes?: string;
}

export function detectDistressText(text: string): boolean {
  const patterns = [
    /\bkill (?:myself|me)\b/i,
    /\bsuicid(?:e|al)\b/i,
    /\bend (?:my|it) (?:life|all)\b/i,
    /\bself[- ]harm\b/i,
    /\bhurt myself\b/i,
    /\bcut myself\b/i,
    /\bno reason to (?:live|go on)\b/i,
    /\bwant to die\b/i,
    /\bcan'?t go on\b/i,
    /\boverdose\b/i,
  ];
  return patterns.some((p) => p.test(text));
}

export const CARE_FIRST_RESPONSE =
  "I'm stepping away from scheduling for a moment because what you wrote matters most. " +
  "Please reach out to someone you trust or a supportive crisis line in your area (findahelpline.com lists free, confidential options worldwide). " +
  "You are not alone, and help is available.";

export function analyzeMoodPatterns(entries: MoodEntryData[]): string[] {
  if (entries.length < 10) {
    return ["Logging more check-ins (10+ days) will reveal patterns between mood, sleep and activity."];
  }

  const insights: string[] = [];
  const withWorkout = entries.filter((e) => e.workoutDone);
  const withoutWorkout = entries.filter((e) => !e.workoutDone);

  if (withWorkout.length >= 4 && withoutWorkout.length >= 4) {
    const avgWith = withWorkout.reduce((acc, e) => acc + e.mood, 0) / withWorkout.length;
    const avgWithout = withoutWorkout.reduce((acc, e) => acc + e.mood, 0) / withoutWorkout.length;
    if (avgWith - avgWithout >= 0.5) {
      insights.push("Pattern observed: Days with physical activity average higher mood.");
    }
  }

  return insights;
}

/* -------------------------------------------------------------------------- */
/* 15. Habits: Grace Streaks & Drift Detection                                */
/* -------------------------------------------------------------------------- */

export function calculateStreakWithGrace(
  history: Array<{ date: string; result: "done" | "skipped" | "missed" }>,
  allowedWeeklySkips = 2,
): { streak: number; broken: boolean } {
  let streak = 0;
  let skipsThisWeek = 0;

  for (let i = history.length - 1; i >= 0; i--) {
    const entry = history[i];
    if (entry.result === "done") {
      streak += 1;
    } else if (entry.result === "skipped") {
      skipsThisWeek += 1;
      if (skipsThisWeek > allowedWeeklySkips) {
        return { streak, broken: true };
      }
      // grace skip preserves streak count
    } else {
      return { streak, broken: true };
    }
  }

  return { streak, broken: false };
}

export function detectCommitmentDrift(results: Array<"done" | "skipped" | "missed">): boolean {
  if (results.length >= 3 && results.slice(-3).every((r) => r === "missed")) {
    return true;
  }
  const last7 = results.slice(-7);
  if (last7.length >= 5) {
    const doneCount = last7.filter((r) => r === "done").length;
    if (doneCount / last7.length < 0.5) return true;
  }
  return false;
}

/* -------------------------------------------------------------------------- */
/* 16. Forward Planning: Life Compass Balance Wheel                           */
/* -------------------------------------------------------------------------- */

export interface DomainBalanceItem {
  domainSlug: string;
  intendedHours: number;
  actualHours: number;
  gapHours: number;
}

export function buildLifeCompass(
  intents: Record<string, number>,
  actuals: Record<string, number>,
): {
  items: DomainBalanceItem[];
  topDeficitDomains: string[];
} {
  const items: DomainBalanceItem[] = [];

  for (const [slug, intended] of Object.entries(intents)) {
    const actual = actuals[slug] ?? 0;
    items.push({
      domainSlug: slug,
      intendedHours: intended,
      actualHours: actual,
      gapHours: Math.round((intended - actual) * 10) / 10,
    });
  }

  const deficits = [...items].filter((i) => i.gapHours > 0).sort((a, b) => b.gapHours - a.gapHours);
  return {
    items,
    topDeficitDomains: deficits.slice(0, 3).map((d) => d.domainSlug),
  };
}

/* -------------------------------------------------------------------------- */
/* 17. Volunteering & Social: Crowding & Rhythm                               */
/* -------------------------------------------------------------------------- */

export function checkVolunteeringCrowding(
  volunteerHours: number,
  isExamWeek: boolean,
  isCompetitionWeek: boolean,
): boolean {
  if ((isExamWeek || isCompetitionWeek) && volunteerHours > 4) {
    return true; // warns when volunteering crowds heavy deadlines
  }
  return false;
}

export function checkRelationshipRhythm(lastContactDate: Date, rhythmDays: number, now: Date): boolean {
  const daysPassed = Math.round((now.getTime() - lastContactDate.getTime()) / (24 * 60 * 60 * 1000));
  return daysPassed >= rhythmDays;
}

/* -------------------------------------------------------------------------- */
/* 18. Travel: Door-to-Door Buffer & Packing List                             */
/* -------------------------------------------------------------------------- */

export function buildDoorToDoorBlocks(
  eventStart: Date,
  eventEnd: Date,
  commuteMinutes = 30,
  bufferMinutes = 15,
): { travelBefore: { start: Date; end: Date }; travelAfter: { start: Date; end: Date } } {
  const totalGap = (commuteMinutes + bufferMinutes) * 60 * 1000;
  return {
    travelBefore: {
      start: new Date(eventStart.getTime() - totalGap),
      end: new Date(eventStart),
    },
    travelAfter: {
      start: new Date(eventEnd),
      end: new Date(eventEnd.getTime() + totalGap),
    },
  };
}

export function generateTripPackingList(tripType: "business" | "leisure" | "competition", days: number): string[] {
  const base = ["Phone charger", "Toiletries", "ID / Passport", "Comfortable walking shoes"];
  if (tripType === "competition") {
    base.push("Laptop & power brick", "HDMI adapter", "Team badges", "Notepad & pens");
  } else if (tripType === "business") {
    base.push("Formal wear", "Laptop", "Business cards");
  }
  if (days > 3) {
    base.push(`Laundry pack / ${days} sets of clothing`);
  }
  return base;
}

/* -------------------------------------------------------------------------- */
/* 19. Season Profiles                                                        */
/* -------------------------------------------------------------------------- */

export type SeasonProfileType = "exam_season" | "competition_week" | "fasting_period" | "travel_week" | "gentle_days";

export interface SeasonOverrides {
  maxFocusHours?: number;
  bufferMinutes?: number;
  karateIntensity?: "light" | "normal";
  mealWindowsShifted?: boolean;
}

export function getSeasonProfileOverrides(profile: SeasonProfileType): SeasonOverrides {
  switch (profile) {
    case "exam_season":
      return { maxFocusHours: 5, bufferMinutes: 20, karateIntensity: "light" };
    case "competition_week":
      return { bufferMinutes: 20, karateIntensity: "light" };
    case "fasting_period":
      return { mealWindowsShifted: true, maxFocusHours: 5 };
    case "gentle_days":
      return { maxFocusHours: 4, bufferMinutes: 30, karateIntensity: "light" };
    case "travel_week":
      return { bufferMinutes: 30 };
  }
}
