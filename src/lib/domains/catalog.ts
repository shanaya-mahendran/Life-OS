/**
 * The 22 life domains that make up LifeOS.
 *
 * Every domain owns a color, an icon, default goals, protected tier (1, 2, or 3),
 * cluster, sensitivity flag, unique system, and its slice of guidance.
 * The calendar, chat router, sidebar, and domain pages all read from this single
 * catalog so a domain can never drift between screens.
 */

export const DOMAIN_CLUSTERS = [
  "study_and_work",
  "body_and_health",
  "mind_and_spirit",
  "people_and_service",
  "life_admin",
] as const;

export type DomainCluster = (typeof DOMAIN_CLUSTERS)[number];

export const DOMAIN_SLUGS = [
  // 1. Study and work (7)
  "career",
  "education",
  "competitions",
  "learning",
  "open-source",
  "blogging",
  "portfolio",
  // 2. Body and health (6)
  "sleep",
  "food",
  "karate",
  "medicine",
  "rest",
  "period",
  // 3. Mind and spirit (4)
  "prayer",
  "mood",
  "habits",
  "planning",
  // 4. People and service (2)
  "volunteering",
  "social",
  // 5. Life admin (3)
  "finance",
  "admin",
  "travel",
] as const;

export type DomainSlug = (typeof DOMAIN_SLUGS)[number];

export type DomainIconName =
  | "briefcase"
  | "graduation"
  | "trophy"
  | "handshake"
  | "code"
  | "food"
  | "moon"
  | "swords"
  | "pen"
  | "brain"
  | "compass"
  | "armchair"
  | "wallet"
  | "clipboard"
  | "users"
  | "folder"
  | "plane"
  | "sparkles"
  | "sunrise"
  | "pill"
  | "smile"
  | "droplet";

export type ProtectedTier = 1 | 2 | 3;

export interface UniqueSystemConfig {
  name: string;
  tagline: string;
  description: string;
}

export interface DomainConfig {
  slug: DomainSlug;
  name: string;
  shortName: string;
  tagline: string;
  /** Unique accent color — from the LifeOS 22-domain color wheel. */
  accent: string;
  icon: DomainIconName;
  cluster: DomainCluster;
  /**
   * Protected Tier:
   * Tier 1: Fixed anchors (Medicine doses, Prayer times, Sleep minimum). NEVER overlapped without explicit confirmation.
   * Tier 2: Protected (Meals, Karate, Rest). Moves only inside bounded rules.
   * Tier 3: Flexible.
   */
  tier: ProtectedTier;
  /** Backwards compatibility boolean for legacy code checking isProtected */
  protectedByDefault: boolean;
  /** Sensitive domains are opt-in and hold strict privacy rules. */
  isSensitive?: boolean;
  /** Unique system specific to this domain */
  uniqueSystem: UniqueSystemConfig;
  /** Seeded goals, editable from the domain page. */
  goals: string[];
  /** Quick-add templates offered on the domain page. */
  eventTypes: { title: string; minutes: number; priorities?: "high" | "normal" }[];
  /** Guidance appended to the orchestrator prompt for this domain. */
  guidance: string;
  /** Rollout wave (1: MVP pattern, 2: Remaining core, 3: Suggested, 4: Sensitive). */
  wave: 1 | 2 | 3 | 4;
}

export const CLUSTER_METADATA: Record<DomainCluster, { name: string; description: string }> = {
  study_and_work: {
    name: "Study and work",
    description: "Every output becomes evidence that feeds Career and Portfolio.",
  },
  body_and_health: {
    name: "Body and health",
    description: "Protected time. Medicine is the strictest: records and reminds, never advises.",
  },
  mind_and_spirit: {
    name: "Mind and spirit",
    description: "Private by default; shapes how other domains plan.",
  },
  people_and_service: {
    name: "People and service",
    description: "Meaningful connections, volunteering hours, and mentor guidance.",
  },
  life_admin: {
    name: "Life admin",
    description: "Budgets, document paper-trails, and travel buffers.",
  },
};

export const DOMAINS: DomainConfig[] = [
  // --------------------------------------------------------------------------
  // Study and work (7)
  // --------------------------------------------------------------------------
  {
    slug: "career",
    name: "Career",
    shortName: "Career",
    tagline: "Applications, interviews and the long game.",
    accent: "#3E7BF0",
    icon: "briefcase",
    cluster: "study_and_work",
    tier: 3,
    protectedByDefault: false,
    uniqueSystem: {
      name: "Skill-gap radar",
      tagline: "Job post skills vs. portfolio evidence",
      description: "Compares skills in target job posts with Learning logs and Portfolio evidence, then books learning blocks for biggest gaps.",
    },
    goals: [
      "Send 3 targeted applications this week",
      "Update CV and LinkedIn before Friday",
      "Book one networking conversation",
    ],
    eventTypes: [
      { title: "Application work", minutes: 60 },
      { title: "Interview prep", minutes: 45 },
      { title: "Networking call", minutes: 30 },
    ],
    guidance: "Career work is deadline driven. Follow up 7 days after applying; schedule prep blocks when interview date is saved.",
    wave: 2,
  },
  {
    slug: "education",
    name: "Education",
    shortName: "Education",
    tagline: "Lectures, assignments and exams.",
    accent: "#4DB3F7",
    icon: "graduation",
    cluster: "study_and_work",
    tier: 3,
    protectedByDefault: false,
    uniqueSystem: {
      name: "Mastery map",
      tagline: "Confidence-weighted spaced revision",
      description: "Each topic carries confidence 0-100; revision time is weighted toward weak and fading topics, stopping 1 day before exam.",
    },
    goals: [
      "Finish Data Structures revision",
      "Submit the Algorithms assignment",
      "Stay one week ahead of lecture notes",
    ],
    eventTypes: [
      { title: "Study block", minutes: 90 },
      { title: "Lecture", minutes: 60 },
      { title: "Exam prep", minutes: 120, priorities: "high" },
    ],
    guidance: "Exam countdown runs backward planning with spaced revision (1, 3, 7, 14 days). Never schedule after bedtime.",
    wave: 1,
  },
  {
    slug: "competitions",
    name: "Competitions",
    shortName: "Competitions",
    tagline: "Hackathons, pitches and results.",
    accent: "#8F9BFF",
    icon: "trophy",
    cluster: "study_and_work",
    tier: 3,
    protectedByDefault: false,
    uniqueSystem: {
      name: "Reverse sprint",
      tagline: "Backward milestone countdown & pitch scorer",
      description: "Counts back from submission: submission -> 2h buffer -> demo recording -> build freeze -> pitch rehearsals -> build blocks.",
    },
    goals: [
      "Ship the hackathon submission",
      "Rehearse the pitch twice",
      "Collect team feedback before judging",
    ],
    eventTypes: [
      { title: "Hackathon build", minutes: 120 },
      { title: "Pitch rehearsal", minutes: 45 },
      { title: "Team sync", minutes: 30 },
    ],
    guidance: "Competition deadlines are hard stops. Protect the final 24 hours for build freeze, demo recording and rehearsal.",
    wave: 1,
  },
  {
    slug: "learning",
    name: "Learning",
    shortName: "Learning",
    tagline: "Skills, roadmaps and deliberate practice.",
    accent: "#22C7E8",
    icon: "brain",
    cluster: "study_and_work",
    tier: 3,
    protectedByDefault: false,
    uniqueSystem: {
      name: "Skill tree",
      tagline: "Prerequisite unlock graph",
      description: "A graph where nodes unlock when prerequisites are done; scores unlocked nodes based on Career gaps and Education goals.",
    },
    goals: ["Practice daily for 45 minutes", "Finish current course module", "Ship one practice project"],
    eventTypes: [
      { title: "Learning block", minutes: 45 },
      { title: "Practice project", minutes: 90 },
      { title: "Resource review", minutes: 30 },
    ],
    guidance: "Learning compounds daily — prefer a consistent daily slot over long weekly marathons.",
    wave: 2,
  },
  {
    slug: "open-source",
    name: "Open Source",
    shortName: "Open Source",
    tagline: "Issues, reviews and weekly contributions.",
    accent: "#8FDA3E",
    icon: "code",
    cluster: "study_and_work",
    tier: 3,
    protectedByDefault: false,
    uniqueSystem: {
      name: "Issue fit scorer",
      tagline: "Match-ranked issues and reserved slots",
      description: "Ranks open issues by skill match, estimated scope, and maintainer response speed, reserving a weekly slot.",
    },
    goals: [
      "Land 2 pull requests this month",
      "Review one community PR each week",
      "Keep a weekly contribution slot",
    ],
    eventTypes: [
      { title: "Open source work", minutes: 120 },
      { title: "PR review", minutes: 45 },
      { title: "Issue triage", minutes: 30 },
    ],
    guidance: "Open source runs best in focused 2-hour blocks. Follow up on PRs idle for 5+ days.",
    wave: 2,
  },
  {
    slug: "blogging",
    name: "Blogging",
    shortName: "Blogging",
    tagline: "Idea to draft to edit to published.",
    accent: "#E056D6",
    icon: "pen",
    cluster: "study_and_work",
    tier: 3,
    protectedByDefault: false,
    uniqueSystem: {
      name: "Idea harvester",
      tagline: "Harvests posts from weekly learning and wins",
      description: "Scans week's learning notes, competition post-mortems and merged PRs, proposing post ideas when 3+ notes align.",
    },
    goals: ["Publish two posts this month", "Keep a weekly drafting slot", "Grow draft backlog to five ideas"],
    eventTypes: [
      { title: "Blog draft", minutes: 90 },
      { title: "Editing pass", minutes: 45 },
      { title: "Outline session", minutes: 30 },
    ],
    guidance: "Writing needs one uninterrupted block in focus hours. Tick publishing checklist before publishing.",
    wave: 2,
  },
  {
    slug: "portfolio",
    name: "Portfolio",
    shortName: "Portfolio",
    tagline: "Projects, certificates, achievements.",
    accent: "#B8528E",
    icon: "folder",
    cluster: "study_and_work",
    tier: 3,
    protectedByDefault: false,
    uniqueSystem: {
      name: "Evidence auto-capture",
      tagline: "Automatic draft entries from finished milestones",
      description: "A finished competition, merged PR, volunteer milestone or post proposes its own Portfolio entry and tailored CV bullets.",
    },
    goals: ["Add two projects with write-ups", "Collect certificates in one place", "Refresh portfolio quarterly"],
    eventTypes: [
      { title: "Portfolio update", minutes: 45 },
      { title: "Project write-up", minutes: 60 },
    ],
    guidance: "Portfolio captures evidence while fresh. Keep private until marked public.",
    wave: 3,
  },

  // --------------------------------------------------------------------------
  // Body and health (6)
  // --------------------------------------------------------------------------
  {
    slug: "sleep",
    name: "Sleep",
    shortName: "Sleep",
    tagline: "Bedtime, wind-down and recovery.",
    accent: "#5B5FD6",
    icon: "moon",
    cluster: "body_and_health",
    tier: 1,
    protectedByDefault: true,
    uniqueSystem: {
      name: "Sleep debt bank",
      tagline: "7-day shortfall repayment without adding load",
      description: "Calculates sleep debt from 7-day shortfalls; repays debt by lightening upcoming days and shifting bedtime earlier.",
    },
    goals: ["Sleep 7.5+ hours nightly", "Wind down 30 minutes before bed", "Wake at a consistent time"],
    eventTypes: [
      { title: "Sleep", minutes: 480 },
      { title: "Wind down", minutes: 30 },
    ],
    guidance: "Sleep is a Tier 1 fixed anchor. Any proposed change that leaves less than the minimum is blocked until confirmed.",
    wave: 1,
  },
  {
    slug: "food",
    name: "Food",
    shortName: "Food",
    tagline: "Meals, prep and planning.",
    accent: "#FF9F43",
    icon: "food",
    cluster: "body_and_health",
    tier: 2,
    protectedByDefault: true,
    uniqueSystem: {
      name: "Prep-once planner",
      tagline: "Load-aware meal assignment and batch cooking",
      description: "Heavy days get zero-cook meals; batch-cooking sessions land on the lightest day. Fasting-aware mode shifts meal windows with Prayer.",
    },
    goals: ["Keep three sit-down meals each day", "Plan next week's meals", "Prep two batch meals"],
    eventTypes: [
      { title: "Breakfast", minutes: 30 },
      { title: "Lunch", minutes: 45 },
      { title: "Dinner", minutes: 60 },
      { title: "Meal prep", minutes: 90 },
    ],
    guidance: "Protected meal windows flex within reason, but a meeting can never silently delete a meal. No calorie or weight targets.",
    wave: 2,
  },
  {
    slug: "karate",
    name: "Karate",
    shortName: "Karate",
    tagline: "Train, improve, excel.",
    accent: "#E5484D",
    icon: "swords",
    cluster: "body_and_health",
    tier: 2,
    protectedByDefault: true,
    uniqueSystem: {
      name: "Belt path",
      tagline: "Grading syllabus countdown & pre-tournament taper",
      description: "Breaks grading syllabus into weekly drill blocks counted back from grading date, and tapers load before competitions. Injury caps load.",
    },
    goals: ["Attend 3 sessions this week", "Improve kata form", "Prepare for next grading"],
    eventTypes: [
      { title: "Karate training", minutes: 90 },
      { title: "Conditioning", minutes: 45 },
      { title: "Kata practice", minutes: 30 },
      { title: "Grading prep", minutes: 120, priorities: "high" },
    ],
    guidance: "Karate sessions are protected Tier 2. Hard sessions cannot be scheduled the day after two hard sessions in a row.",
    wave: 1,
  },
  {
    slug: "medicine",
    name: "Medicine",
    shortName: "Medicine",
    tagline: "Dose schedule, refill countdown, and visit briefs.",
    accent: "#2DD4BF",
    icon: "pill",
    cluster: "body_and_health",
    tier: 1,
    protectedByDefault: true,
    isSensitive: true,
    uniqueSystem: {
      name: "Dose-safe scheduler",
      tagline: "Tier 1 fixed dose anchors & visit brief",
      description: "Dose times are fixed anchors that other domains must plan around; never moves one without confirmation. Visit brief summarizes logs.",
    },
    goals: ["Take daily doses on time", "Track refills with 5-day buffer", "Log symptom notes for appointments"],
    eventTypes: [
      { title: "Morning dose", minutes: 15 },
      { title: "Evening dose", minutes: 15 },
      { title: "Doctor appointment", minutes: 60 },
    ],
    guidance: "Strict boundary: no medical diagnosis and no dosing advice. Dose times are immutable Tier 1 anchors.",
    wave: 4,
  },
  {
    slug: "rest",
    name: "Rest & Buffer",
    shortName: "Rest",
    tagline: "Downtime and slack between blocks.",
    accent: "#86D8B0",
    icon: "armchair",
    cluster: "body_and_health",
    tier: 2,
    protectedByDefault: true,
    uniqueSystem: {
      name: "Recovery forecast",
      tagline: "Burnout prediction combining load, debt and mood",
      description: "Combines planned load, sleep debt and mood trend to show burnout risk for the coming week, proposing extra buffer before the week starts.",
    },
    goals: ["Keep buffer between back-to-back blocks", "Take one full rest evening weekly", "Protect weekend mornings"],
    eventTypes: [
      { title: "Buffer break", minutes: 15 },
      { title: "Rest & buffer", minutes: 60 },
      { title: "Deep rest", minutes: 120 },
    ],
    guidance: "Buffer time prevents burnout. Insert minimum 15 min gaps after long blocks. Flag daily overloads.",
    wave: 2,
  },
  {
    slug: "period",
    name: "Period Tracking",
    shortName: "Period",
    tagline: "Cycle logs, range predictions, and discreet cross-domain links.",
    accent: "#D6336C",
    icon: "droplet",
    cluster: "body_and_health",
    tier: 3,
    protectedByDefault: false,
    isSensitive: true,
    uniqueSystem: {
      name: "Cycle range predictor",
      tagline: "Discreet range forecast & gentle cross-domain links",
      description: "Takes shortest to longest range of last 6 cycles; privately adjusts Prayer excused days, Sleep goals, and offers Gentle Days mode.",
    },
    goals: ["Log cycle start and end", "Note energy and flow patterns", "Track gentle recovery days"],
    eventTypes: [
      { title: "Cycle check-in", minutes: 5 },
      { title: "Rest period", minutes: 30 },
    ],
    guidance: "Strictly private: no medical advice, no pregnancy/fertility claims. Generic notifications only.",
    wave: 4,
  },

  // --------------------------------------------------------------------------
  // Mind and spirit (4)
  // --------------------------------------------------------------------------
  {
    slug: "prayer",
    name: "Prayer",
    shortName: "Prayer",
    tagline: "Entered prayer times, moving anchors, and GitHub-style heatmaps.",
    accent: "#D17FF5",
    icon: "sunrise",
    cluster: "mind_and_spirit",
    tier: 1,
    protectedByDefault: true,
    isSensitive: true,
    uniqueSystem: {
      name: "Moving prayer anchors & Year heatmap",
      tagline: "5 daily entered times as Tier 1 anchors & 5-shade contribution graph",
      description: "User enters start times of Fajr, Dhuhr, Asr, Maghrib, Isha. One-tap check-ins (on time, late, missed, excused) feed a 5-shade year heatmap.",
    },
    goals: ["Pray all five daily prayers", "Maintain on-time prayer streak", "Fajr consistency"],
    eventTypes: [
      { title: "Fajr", minutes: 20 },
      { title: "Dhuhr", minutes: 20 },
      { title: "Asr", minutes: 20 },
      { title: "Maghrib", minutes: 20 },
      { title: "Isha", minutes: 20 },
    ],
    guidance: "Prayer blocks are Tier 1 anchors. The planner places everything around them and never moves a prayer block without confirmation.",
    wave: 4,
  },
  {
    slug: "mood",
    name: "Mood Reflections",
    shortName: "Mood",
    tagline: "Daily 10-second check-in, energy scale, and private weather map.",
    accent: "#F472B6",
    icon: "smile",
    cluster: "mind_and_spirit",
    tier: 3,
    protectedByDefault: false,
    isSensitive: true,
    uniqueSystem: {
      name: "Private weather map",
      tagline: "Pattern discovery across sleep, training, work and outdoors",
      description: "Correlates mood and energy (1-5) against sleep, workouts, and workload. Gentle mode proposes lighter tomorrow. Care-first distress handling.",
    },
    goals: ["Daily 10-second check-in", "Notice lifting vs draining factors", "Opt for gentle days when needed"],
    eventTypes: [
      { title: "Morning mood check-in", minutes: 5 },
      { title: "Evening mood reflection", minutes: 10 },
    ],
    guidance: "Not therapy, no diagnosis. If text shows serious distress or mentions self-harm, pause planning and provide crisis resources.",
    wave: 4,
  },
  {
    slug: "habits",
    name: "Habits & Reflection",
    shortName: "Habits",
    tagline: "Daily check-in, streaks with grace, and habit stacking.",
    accent: "#FB6F92",
    icon: "sparkles",
    cluster: "mind_and_spirit",
    tier: 2,
    protectedByDefault: true,
    uniqueSystem: {
      name: "Streaks with grace & Habit stacking",
      tagline: "Forgiving streaks and cue attachment to steady habits",
      description: "Skips inside grace setting keep the streak alive. Attaches new habits to habits with >=80% adherence. Drift detection offers lighter plans.",
    },
    goals: ["Daily evening check-in", "Keep reflection streak alive", "Note energy and consistency"],
    eventTypes: [
      { title: "Habit check-in", minutes: 10 },
      { title: "Weekly reflection", minutes: 20 },
    ],
    guidance: "Check-ins should be quick and daily. Never bundle into an overwhelming weekly backlog.",
    wave: 3,
  },
  {
    slug: "planning",
    name: "Forward Planning",
    shortName: "Planning",
    tagline: "Weekly review, monthly goals, yearly direction, and Life Compass.",
    accent: "#D9DCEF",
    icon: "compass",
    cluster: "mind_and_spirit",
    tier: 2,
    protectedByDefault: true,
    uniqueSystem: {
      name: "Life compass",
      tagline: "Domain intent balance wheel & decision journal",
      description: "Compares intended hours vs actual hours per domain in Sunday reviews, highlighting top 3 gaps and rebalancing. Stores decision predictions.",
    },
    goals: ["Run Sunday review every week", "Set three monthly goals", "Revisit yearly direction monthly"],
    eventTypes: [
      { title: "Weekly review", minutes: 45 },
      { title: "Monthly planning", minutes: 60 },
      { title: "Decision check", minutes: 20 },
    ],
    guidance: "Planning sessions are where decisions are made. Keep quiet and uninterrupted.",
    wave: 2,
  },

  // --------------------------------------------------------------------------
  // People and service (2)
  // --------------------------------------------------------------------------
  {
    slug: "volunteering",
    name: "Volunteering",
    shortName: "Volunteering",
    tagline: "Shifts, hours and commitments.",
    accent: "#3FC76A",
    icon: "handshake",
    cluster: "people_and_service",
    tier: 2,
    protectedByDefault: false,
    uniqueSystem: {
      name: "Impact ledger",
      tagline: "Shareable impact summary & crowding warnings",
      description: "Turns logged hours and notes into a shareable impact summary, and warns when volunteering hours crowd an exam or competition week.",
    },
    goals: ["Log 6 volunteering hours this month", "Confirm next event shift", "Prepare session materials"],
    eventTypes: [
      { title: "Volunteering shift", minutes: 180 },
      { title: "Session prep", minutes: 45 },
    ],
    guidance: "Volunteering shifts are fixed commitments with travel buffers. Warn if crowding heavy exam weeks.",
    wave: 2,
  },
  {
    slug: "social",
    name: "Social & Mentors",
    shortName: "Social",
    tagline: "Family, friends and mentors.",
    accent: "#FF7F6B",
    icon: "users",
    cluster: "people_and_service",
    tier: 3,
    protectedByDefault: false,
    uniqueSystem: {
      name: "Relationship rhythm",
      tagline: "Gentle gap nudges & mentor prep sheet",
      description: "Gentle nudges appear when contact gap passes personal rhythm. Compiles mentor prep sheets with recent progress from approved domains.",
    },
    goals: ["Check in with a mentor monthly", "Plan one family call each week", "Keep one social evening free"],
    eventTypes: [
      { title: "Family time", minutes: 120 },
      { title: "Mentor catch-up", minutes: 45 },
      { title: "Friends", minutes: 120 },
    ],
    guidance: "Relationships require recurring attention. Prep sheets only include domains approved by the user.",
    wave: 3,
  },

  // --------------------------------------------------------------------------
  // Life admin (3)
  // --------------------------------------------------------------------------
  {
    slug: "finance",
    name: "Finance",
    shortName: "Finance",
    tagline: "Budgets, prizes and payment deadlines.",
    accent: "#E8B93F",
    icon: "wallet",
    cluster: "life_admin",
    tier: 3,
    protectedByDefault: false,
    uniqueSystem: {
      name: "Funding radar",
      tagline: "Scholarship backward planning & deadline coverage",
      description: "Every scholarship/prize deadline turns into backwards-planned work blocks (essay, documents, review) and shows covered vs at-risk deadlines.",
    },
    goals: ["Review monthly budget", "Track scholarship and prize deadlines", "Set up one payment reminder"],
    eventTypes: [
      { title: "Finance review", minutes: 45 },
      { title: "Funding prep block", minutes: 60 },
      { title: "Payment deadline", minutes: 30, priorities: "high" },
    ],
    guidance: "No investment, tax or financial advice. Plans time and tracks arithmetic.",
    wave: 3,
  },
  {
    slug: "admin",
    name: "Admin",
    shortName: "Admin",
    tagline: "Forms, fees, renewals.",
    accent: "#B5BC4A",
    icon: "clipboard",
    cluster: "life_admin",
    tier: 3,
    protectedByDefault: false,
    uniqueSystem: {
      name: "Paper-trail builder",
      tagline: "Lead-time document scheduler & 30/14/7/1 day ladder",
      description: "Builds list of required documents with lead times and schedules each backward from deadline. Reminders ladder at 30, 14, 7 and 1 days.",
    },
    goals: ["Clear form backlog", "Renew documents before expiry", "Batch admin into one weekly slot"],
    eventTypes: [
      { title: "Admin batch", minutes: 45 },
      { title: "Document renewal", minutes: 30, priorities: "high" },
      { title: "Form filing", minutes: 45 },
    ],
    guidance: "Admin is easily deferred — schedule concrete blocks backward from deadlines with required lead times.",
    wave: 3,
  },
  {
    slug: "travel",
    name: "Travel & Commute",
    shortName: "Travel",
    tagline: "Buffers between places.",
    accent: "#8AA0BA",
    icon: "plane",
    cluster: "life_admin",
    tier: 3,
    protectedByDefault: false,
    uniqueSystem: {
      name: "Door-to-door blocks",
      tagline: "Automatic travel buffers & trip packing lists",
      description: "Inserts travel + buffer blocks before and after events with a location. Generates packing lists based on trip type and days away.",
    },
    goals: ["Always leave a commute buffer", "Book travel two weeks ahead", "Keep a go-bag ready"],
    eventTypes: [
      { title: "Commute", minutes: 30 },
      { title: "Travel transit", minutes: 120 },
      { title: "Packing prep", minutes: 45 },
    ],
    guidance: "Events with a location get travel + buffer blocks inserted around them so the calendar reflects real time costs.",
    wave: 3,
  },
];

export const DOMAIN_MAP: Record<string, DomainConfig> = Object.fromEntries(
  DOMAINS.map((domain) => [domain.slug, domain]),
);

export function getDomain(slug: string): DomainConfig | undefined {
  return DOMAIN_MAP[slug];
}

export function domainName(slug: string): string {
  return DOMAIN_MAP[slug]?.name ?? slug;
}

export function domainAccent(slug: string): string {
  return DOMAIN_MAP[slug]?.accent ?? "#7c5cff";
}

export function domainTier(slug: string): ProtectedTier {
  return DOMAIN_MAP[slug]?.tier ?? 3;
}

export function isDomainSlug(value: string): value is DomainSlug {
  return (DOMAIN_SLUGS as readonly string[]).includes(value as DomainSlug);
}

export function getDomainsInCluster(cluster: DomainCluster): DomainConfig[] {
  return DOMAINS.filter((domain) => domain.cluster === cluster);
}
