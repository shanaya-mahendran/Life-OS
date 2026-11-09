/**
 * LifeOS Cross-Domain Ecosystem Engine
 *
 * Implements the 5 core cross-domain systems connecting all 22 domains:
 * 1. Protected Tiers (Tier 1 fixed anchors vs Tier 2 protected vs Tier 3 flexible)
 * 2. Energy Budget (Daily capacity computed from sleep, mood, and previous load)
 * 3. Season Profiles (Exam Season, Competition Sprint, Fasting Period, Deload Week, Normal)
 * 4. Life Graph (Inter-domain entity relationships & "Why is this block here?")
 * 5. Evidence Loop (Cross-domain event propagation: Competitions/OS/Volunteering -> Portfolio/Career/Learning)
 */

import { type DomainSlug, DOMAIN_MAP } from "./catalog";

/* -------------------------------------------------------------------------- */
/* 1. Cross-Domain Linkages Catalog                                           */
/* -------------------------------------------------------------------------- */

export interface DomainEcosystemTie {
  targetSlug: DomainSlug;
  relationship: "feeds_into" | "receives_from" | "synchronizes_with" | "protects_against";
  label: string;
  description: string;
}

export const DOMAIN_ECOSYSTEM_MAP: Record<DomainSlug, DomainEcosystemTie[]> = {
  career: [
    { targetSlug: "learning", relationship: "feeds_into", label: "Skill-Gap Radar", description: "Target job requirements feed missing skills into the Learning Skill Tree." },
    { targetSlug: "portfolio", relationship: "receives_from", label: "Proof & Evidence", description: "Portfolio evidence and case studies back up CV applications." },
    { targetSlug: "social", relationship: "synchronizes_with", label: "Networking Rhythm", description: "Mentor and recruiter follow-ups align with social contact cadences." },
  ],
  education: [
    { targetSlug: "sleep", relationship: "protects_against", label: "Exam Sleep Floor", description: "Revision sprints cannot encroach upon minimum sleep anchors." },
    { targetSlug: "karate", relationship: "feeds_into", label: "Taper Conditioning", description: "Heavy exam weeks automatically scale down Karate to light sessions." },
    { targetSlug: "rest", relationship: "feeds_into", label: "Recovery Forecast", description: "High exam load alerts the Rest & Buffer recovery forecast." },
    { targetSlug: "volunteering", relationship: "protects_against", label: "Crowding Guard", description: "Volunteering shifts are flagged if scheduled during exam weeks." },
  ],
  competitions: [
    { targetSlug: "portfolio", relationship: "feeds_into", label: "Evidence Auto-Capture", description: "Finished hackathons and competitions auto-propose Portfolio case studies." },
    { targetSlug: "career", relationship: "feeds_into", label: "Experience Log", description: "Competition results append verified achievements to Career profiles." },
    { targetSlug: "learning", relationship: "feeds_into", label: "Skill Verification", description: "Hackathon project technologies mark Learning nodes as solid." },
    { targetSlug: "food", relationship: "feeds_into", label: "Meal Windows", description: "Reverse sprint rehearsal windows schedule around protected meal times." },
  ],
  learning: [
    { targetSlug: "career", relationship: "receives_from", label: "Industry Demand", description: "Skill tree priorities are raised when matched against target job postings." },
    { targetSlug: "education", relationship: "synchronizes_with", label: "Curriculum Synergy", description: "Course syllabus topics unlock corresponding practical skills." },
    { targetSlug: "blogging", relationship: "feeds_into", label: "Idea Harvester", description: "Weekly study notes with 3+ references propose technical blog posts." },
  ],
  "open-source": [
    { targetSlug: "portfolio", relationship: "feeds_into", label: "Code Evidence", description: "Merged pull requests generate draft portfolio contribution records." },
    { targetSlug: "career", relationship: "feeds_into", label: "Public Track Record", description: "Open source contributions feed into CV engineering credentials." },
    { targetSlug: "learning", relationship: "feeds_into", label: "Skill Mastery", description: "Active repository contributions validate framework proficiencies." },
  ],
  blogging: [
    { targetSlug: "portfolio", relationship: "feeds_into", label: "Published Works", description: "Published articles create public portfolio artifacts." },
    { targetSlug: "career", relationship: "feeds_into", label: "Thought Leadership", description: "Writing showcases domain authority to prospective teams." },
    { targetSlug: "learning", relationship: "receives_from", label: "Harvested Notes", description: "Weekly learning reflections serve as seeds for technical articles." },
  ],
  portfolio: [
    { targetSlug: "career", relationship: "feeds_into", label: "Application Kits", description: "Selects best evidence items to auto-generate tailored CV bullet points." },
    { targetSlug: "competitions", relationship: "receives_from", label: "Project Entries", description: "Hackathons and submissions feed structured project evidence." },
    { targetSlug: "open-source", relationship: "receives_from", label: "Code Contributions", description: "Merged PRs become verified work artifacts." },
  ],
  sleep: [
    { targetSlug: "rest", relationship: "feeds_into", label: "Energy Budget", description: "Sleep debt shortfalls reduce daily available cognitive energy." },
    { targetSlug: "food", relationship: "synchronizes_with", label: "Circadian Rhythm", description: "Dinner windows align with the wind-down routine 2 hours before bed." },
    { targetSlug: "prayer", relationship: "synchronizes_with", label: "Fasting & Night Vigils", description: "Fasting periods adjust wake time for Suhoor and split sleep patterns." },
  ],
  food: [
    { targetSlug: "prayer", relationship: "receives_from", label: "Fasting Windows", description: "Prayer calendar replaces daytime meal windows with Suhoor & Iftar." },
    { targetSlug: "medicine", relationship: "synchronizes_with", label: "With-Food Dosing", description: "Meal windows ensure medication requiring food is timed accurately." },
    { targetSlug: "rest", relationship: "synchronizes_with", label: "Load Match", description: "Prep-once planner schedules zero-cook meals on high-load days." },
  ],
  karate: [
    { targetSlug: "education", relationship: "receives_from", label: "Exam Season Taper", description: "Reduces to maintenance sessions during academic assessment weeks." },
    { targetSlug: "competitions", relationship: "feeds_into", label: "Tournament Prep", description: "Belt path peaks conditioning 1 week prior to competition dates." },
    { targetSlug: "rest", relationship: "protects_against", label: "Recovery Gap", description: "Enforces 24h recovery between intense sparring sessions." },
  ],
  medicine: [
    { targetSlug: "sleep", relationship: "protects_against", label: "Bedtime Consistency", description: "Evening doses synchronize with fixed bedtime anchors." },
    { targetSlug: "food", relationship: "synchronizes_with", label: "Meal Anchors", description: "Reminders check if dose requires full meal or empty stomach." },
    { targetSlug: "rest", relationship: "feeds_into", label: "Health Baselines", description: "Symptom logs inform recovery forecasts without medical diagnosis." },
  ],
  rest: [
    { targetSlug: "mood", relationship: "receives_from", label: "Weather Map Trend", description: "7-day low mood trends automatically expand buffer requirements." },
    { targetSlug: "sleep", relationship: "receives_from", label: "Sleep Debt Deficit", description: "Debt over 2 hours triggers 30-minute load reduction proposals." },
    { targetSlug: "education", relationship: "protects_against", label: "Burnout Defense", description: "Prevents consecutive 10-hour study days without deload days." },
  ],
  prayer: [
    { targetSlug: "food", relationship: "feeds_into", label: "Fasting Windows", description: "Fasting dates shift meal windows to sunrise and sunset." },
    { targetSlug: "sleep", relationship: "feeds_into", label: "Moving Solar Anchors", description: "Fajr and Tahajjud shifts wake schedule according to solar coordinates." },
    { targetSlug: "rest", relationship: "protects_against", label: "Tier 1 Priority", description: "Prayer times take precedence over non-anchor scheduling." },
  ],
  mood: [
    { targetSlug: "rest", relationship: "feeds_into", label: "Gentle Mode", description: "Low energy scores propose lightening next day's task load." },
    { targetSlug: "habits", relationship: "synchronizes_with", label: "Streak Grace", description: "Difficult days utilize habit grace periods without guilt." },
    { targetSlug: "sleep", relationship: "receives_from", label: "Circadian Correlation", description: "Correlates mood variance with 7-day sleep duration trends." },
  ],
  habits: [
    { targetSlug: "planning", relationship: "feeds_into", label: "Commitment Adherence", description: "Habit completions feed into Reset Plan adherence metrics." },
    { targetSlug: "mood", relationship: "receives_from", label: "Energy Context", description: "Habit difficulty scales according to current energy state." },
  ],
  planning: [
    { targetSlug: "career", relationship: "synchronizes_with", label: "Life Compass", description: "Weekly review compares intended Career hours against actual." },
    { targetSlug: "education", relationship: "synchronizes_with", label: "Academic Intent", description: "Checks if actual study hours match quarterly targets." },
    { targetSlug: "finance", relationship: "synchronizes_with", label: "Savings Horizons", description: "Aligns financial savings progress with long-term goals." },
  ],
  volunteering: [
    { targetSlug: "education", relationship: "protects_against", label: "Exam Overlap Warning", description: "Warns if shift hours crowd an upcoming exam week." },
    { targetSlug: "portfolio", relationship: "feeds_into", label: "Impact Ledger", description: "Volunteer leadership milestones feed into CV and scholarship summaries." },
  ],
  social: [
    { targetSlug: "career", relationship: "synchronizes_with", label: "Mentor Prep", description: "Gathers progress across allowed domains before mentor calls." },
    { targetSlug: "rest", relationship: "synchronizes_with", label: "Social Energy", description: "Balances social engagements against weekly recovery budgets." },
  ],
  finance: [
    { targetSlug: "career", relationship: "synchronizes_with", label: "Compensation Target", description: "Budget requirements establish target job salary floors." },
    { targetSlug: "education", relationship: "feeds_into", label: "Funding Radar", description: "Scholarship deadlines backward-plan essay writing sessions." },
  ],
  admin: [
    { targetSlug: "finance", relationship: "synchronizes_with", label: "Billing Renewals", description: "Subscription expiries trigger budget renewal reviews." },
    { targetSlug: "travel", relationship: "synchronizes_with", label: "Paper-Trail Builder", description: "Visa and passport lead times schedule before travel dates." },
  ],
  travel: [
    { targetSlug: "sleep", relationship: "feeds_into", label: "Timezone Adaptation", description: "Calculates gradual bedtime shifts to minimize jetlag." },
    { targetSlug: "admin", relationship: "receives_from", label: "Travel Documents", description: "Pulls travel packing lists and visa confirmations." },
    { targetSlug: "rest", relationship: "feeds_into", label: "Door-to-Door Buffer", description: "Wraps flights and trains with real transit padding." },
  ],
  period: [
    { targetSlug: "karate", relationship: "synchronizes_with", label: "Training Phase Fit", description: "Luteal phase tapers intense sparring; follicular phase boosts conditioning." },
    { targetSlug: "sleep", relationship: "synchronizes_with", label: "Recovery Needs", description: "Adds 30m extra sleep window during menstrual phase." },
    { targetSlug: "mood", relationship: "synchronizes_with", label: "Cycle Awareness", description: "Correlates energy check-ins with cycle phase context." },
  ],
};

/* -------------------------------------------------------------------------- */
/* 2. Season Profiles Engine                                                  */
/* -------------------------------------------------------------------------- */

export type SeasonProfileKey = "normal" | "exam_season" | "competition_sprint" | "fasting_period" | "travel_week" | "deload_week";

export interface SeasonProfileDefinition {
  key: SeasonProfileKey;
  name: string;
  badge: string;
  accent: string;
  description: string;
  overrides: {
    domainSlug: DomainSlug;
    ruleChange: string;
  }[];
}

export const SEASON_PROFILES: Record<SeasonProfileKey, SeasonProfileDefinition> = {
  normal: {
    key: "normal",
    name: "Balanced Baseline",
    badge: "Default",
    accent: "#8b5cf6",
    description: "Standard balanced scheduling across all 22 domains with default buffers and routine tiers.",
    overrides: [],
  },
  exam_season: {
    key: "exam_season",
    name: "Exam Season",
    badge: "High Focus",
    accent: "#38bdf8",
    description: "Academic priorities take center stage. Study blocks are prioritized, extracurriculars taper, and recovery buffers widen.",
    overrides: [
      { domainSlug: "education", ruleChange: "Revision blocks prioritized during daily focus hours (60-90m blocks)" },
      { domainSlug: "karate", ruleChange: "Training reduced to light conditioning sessions (no heavy sparring)" },
      { domainSlug: "volunteering", ruleChange: "Non-critical shifts paused to protect revision windows" },
      { domainSlug: "rest", ruleChange: "Mandatory 15-minute buffers inserted between consecutive study sessions" },
      { domainSlug: "food", ruleChange: "Prep-once mode assigns zero-cook quick meals during peak days" },
    ],
  },
  competition_sprint: {
    key: "competition_sprint",
    name: "Competition Sprint",
    badge: "Sprint",
    accent: "#f59e0b",
    description: "Reverse sprint mode active. Build freeze, demo capture, pitch rehearsals, and final submission buffer locked.",
    overrides: [
      { domainSlug: "competitions", ruleChange: "Locked 2-hour submission buffer + rehearsal slots scheduled" },
      { domainSlug: "sleep", ruleChange: "Strict minimum sleep floor enforced (no all-nighters allowed)" },
      { domainSlug: "career", ruleChange: "Networking follow-ups snoozed until sprint conclusion" },
      { domainSlug: "portfolio", ruleChange: "Evidence capture staged for immediate submission post-mortem" },
    ],
  },
  fasting_period: {
    key: "fasting_period",
    name: "Fasting Period",
    badge: "Mind & Spirit",
    accent: "#e879f9",
    description: "Spiritual calendar active (e.g. Ramadan, Navratri, Lent, Yom Kippur). Meal windows and sleep schedules adapt to prayer times.",
    overrides: [
      { domainSlug: "food", ruleChange: "Daytime meal windows replaced with pre-dawn (Suhoor) and post-sunset (Iftar)" },
      { domainSlug: "prayer", ruleChange: "Solar anchors define day boundaries with enhanced prayer reminders" },
      { domainSlug: "sleep", ruleChange: "Split-sleep schedule activated with earlier bedtime and pre-dawn wake-up" },
      { domainSlug: "karate", ruleChange: "Physical workouts shifted to post-sunset or light morning mobility" },
    ],
  },
  travel_week: {
    key: "travel_week",
    name: "Travel & Commute Week",
    badge: "Transit",
    accent: "#10b981",
    description: "Door-to-door transit padding, packing checklists, and automatic timezone shifting activated.",
    overrides: [
      { domainSlug: "travel", ruleChange: "60-120 min door-to-door buffers auto-wrapped around departures" },
      { domainSlug: "sleep", ruleChange: "Circadian shift planner shifts sleep anchor 30m/day toward destination zone" },
      { domainSlug: "medicine", ruleChange: "Travel medication kit reminder + dosage timezone adjustment" },
    ],
  },
  deload_week: {
    key: "deload_week",
    name: "Deload & Recovery",
    badge: "Recharge",
    accent: "#a78bfa",
    description: "Intentional recovery week. Reduces physical and cognitive load by 50% to prevent burnout.",
    overrides: [
      { domainSlug: "karate", ruleChange: "Deload week: active recovery, stretching, and mobility only" },
      { domainSlug: "education", ruleChange: "No new topics; light spaced review only (<45 min sessions)" },
      { domainSlug: "sleep", ruleChange: "Sleep target bumped by +60 minutes to pay off accumulated sleep debt" },
      { domainSlug: "rest", ruleChange: "Full true day off scheduled with zero commitments" },
    ],
  },
};

/* -------------------------------------------------------------------------- */
/* 3. Energy Budget System                                                    */
/* -------------------------------------------------------------------------- */

export interface EnergyBudgetSummary {
  date: string;
  capacityPoints: number; // Daily budget (e.g. 10-18 points)
  spentPoints: number;
  remainingPoints: number;
  isOverBudget: boolean;
  factors: {
    sleepContribution: number; // based on sleep vs minimum
    moodContribution: number; // based on latest mood/energy check-in
    previousLoadPenalty: number;
  };
  recommendation: string | null;
}

export function calculateDailyEnergyBudget(input: {
  sleepHours: number;
  minSleepHours: number;
  recentMoodScore?: number; // 1 to 5
  recentEnergyScore?: number; // 1 to 5
  previousDayPlannedMinutes?: number;
  todayPlannedBlocks: Array<{ minutes: number; domainSlug: string; isDemanding?: boolean }>;
}): EnergyBudgetSummary {
  const {
    sleepHours,
    minSleepHours,
    recentMoodScore = 3.5,
    recentEnergyScore = 3.5,
    previousDayPlannedMinutes = 300,
    todayPlannedBlocks,
  } = input;

  // Base budget: 12 points
  let basePoints = 12;

  // Sleep adjustment: +/- 3 points
  const sleepDelta = sleepHours - minSleepHours;
  const sleepContribution = Math.round(Math.max(-4, Math.min(3, sleepDelta * 2)));

  // Mood/Energy adjustment: +/- 2 points
  const moodContribution = Math.round(((recentMoodScore + recentEnergyScore) / 2 - 3) * 1.5);

  // Previous day penalty: if yesterday was > 7h of planned work, -2 points
  const previousLoadPenalty = previousDayPlannedMinutes > 420 ? -2 : 0;

  const capacityPoints = Math.max(6, basePoints + sleepContribution + moodContribution + previousLoadPenalty);

  // Calculate spent points from today's blocks
  // Demanding block (study, coding, sparring) = ~1 point per 45 min
  // Regular block = ~0.6 point per 45 min
  // Rest / meal / sleep = 0 points
  let spentPoints = 0;
  for (const block of todayPlannedBlocks) {
    const slug = block.domainSlug;
    if (["sleep", "rest", "food", "prayer"].includes(slug)) continue;
    const durationBlocks = block.minutes / 45;
    const weight = block.isDemanding || ["education", "competitions", "career", "open-source", "karate"].includes(slug)
      ? 1.0
      : 0.6;
    spentPoints += Math.round(durationBlocks * weight * 10) / 10;
  }

  spentPoints = Math.round(spentPoints * 10) / 10;
  const remainingPoints = Math.round((capacityPoints - spentPoints) * 10) / 10;
  const isOverBudget = remainingPoints < 0;

  let recommendation: string | null = null;
  if (isOverBudget) {
    recommendation = `You have scheduled ${spentPoints} points of demanding work against an energy capacity of ${capacityPoints} points. Consider deferring your lowest-priority block to prevent burnout.`;
  } else if (remainingPoints <= 2) {
    recommendation = `Full day planned (${spentPoints}/${capacityPoints} points). Ensure protected buffer times between sessions.`;
  }

  return {
    date: new Date().toISOString().split("T")[0],
    capacityPoints,
    spentPoints,
    remainingPoints,
    isOverBudget,
    factors: {
      sleepContribution,
      moodContribution,
      previousLoadPenalty,
    },
    recommendation,
  };
}

/* -------------------------------------------------------------------------- */
/* 4. Evidence Loop Pipeline                                                  */
/* -------------------------------------------------------------------------- */

export interface EvidenceLoopTrigger {
  sourceDomain: "competitions" | "open-source" | "volunteering" | "blogging";
  sourceTitle: string;
  skillsDemonstrated: string[];
  impactSummary: string;
  url?: string;
}

export interface EvidenceLoopProposal {
  portfolioEntry: {
    title: string;
    skills: string[];
    summary: string;
    visibility: "private" | "public";
  };
  careerUpdate: {
    bulletPoint: string;
    skillTags: string[];
  };
  learningSkillsToAdvance: string[];
  bloggingPitch?: string;
}

export function runEvidenceLoop(trigger: EvidenceLoopTrigger): EvidenceLoopProposal {
  const { sourceDomain, sourceTitle, skillsDemonstrated, impactSummary, url } = trigger;

  const portfolioEntry = {
    title: `${sourceTitle} (${sourceDomain.toUpperCase()})`,
    skills: skillsDemonstrated,
    summary: impactSummary,
    visibility: "private" as const,
  };

  const careerUpdate = {
    bulletPoint: `Demonstrated ${skillsDemonstrated.slice(0, 3).join(", ")} by completing ${sourceTitle}: ${impactSummary}`,
    skillTags: skillsDemonstrated,
  };

  const bloggingPitch = sourceDomain === "competitions" || sourceDomain === "open-source"
    ? `Post-mortem: Key lessons learned building and shipping ${sourceTitle}`
    : undefined;

  return {
    portfolioEntry,
    careerUpdate,
    learningSkillsToAdvance: skillsDemonstrated,
    bloggingPitch,
  };
}
