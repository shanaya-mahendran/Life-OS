/**
 * The 18 life domains that make up LifeOS.
 *
 * Every domain owns a colour, an icon, default goals and its own slice of the
 * agent prompt. The calendar, chat router, sidebar and domain pages all read
 * from this single catalogue so a domain can never drift between screens.
 */

export const DOMAIN_SLUGS = [
  "career",
  "education",
  "competitions",
  "volunteering",
  "open-source",
  "food",
  "sleep",
  "karate",
  "blogging",
  "learning",
  "planning",
  "rest",
  "finance",
  "admin",
  "social",
  "portfolio",
  "travel",
  "habits",
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
  | "sparkles";

export interface DomainConfig {
  slug: DomainSlug;
  name: string;
  shortName: string;
  tagline: string;
  /** Unique accent colour — displayed on chips, event blocks and domain pages. */
  accent: string;
  icon: DomainIconName;
  /** Protected domains trigger a confirmation before the agent edits them. */
  protectedByDefault: boolean;
  /** Seeded goals, editable from the domain page. */
  goals: string[];
  /** Quick-add templates offered on the domain page. */
  eventTypes: { title: string; minutes: number; priorities?: "high" | "normal" }[];
  /** Extra guidance appended to the orchestrator prompt for this domain. */
  guidance: string;
  /** Phase wave from the build plan (1 = MVP first wave). */
  wave: 1 | 2;
}

export const DOMAINS: DomainConfig[] = [
  {
    slug: "career",
    name: "Career",
    shortName: "Career",
    tagline: "Applications, interviews and the long game.",
    accent: "#3b82f6",
    icon: "briefcase",
    protectedByDefault: false,
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
    guidance:
      "Career work is deadline driven. Always ask which role or company a block belongs to.",
    wave: 2,
  },
  {
    slug: "education",
    name: "Education",
    shortName: "Education",
    tagline: "Lectures, assignments and exams.",
    accent: "#6366f1",
    icon: "graduation",
    protectedByDefault: false,
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
    guidance:
      "For exams, plan revision backwards from the exam date in 60-120 minute blocks and never schedule after midnight.",
    wave: 1,
  },
  {
    slug: "competitions",
    name: "Competitions",
    shortName: "Competitions",
    tagline: "Hackathons, pitches and results.",
    accent: "#f59e0b",
    icon: "trophy",
    protectedByDefault: false,
    goals: [
      "Ship the hackathon submission",
      "Rehearse the pitch twice",
      "Collect team feedback before judging",
    ],
    eventTypes: [
      { title: "Hackathon build", minutes: 120 },
      { title: "Pitch practice", minutes: 45 },
      { title: "Team sync", minutes: 30 },
    ],
    guidance:
      "Competition deadlines are hard stops. Protect the final 24 hours for submission and pitch rehearsal.",
    wave: 1,
  },
  {
    slug: "volunteering",
    name: "Volunteering",
    shortName: "Volunteering",
    tagline: "Shifts, hours and commitments.",
    accent: "#10b981",
    icon: "handshake",
    protectedByDefault: false,
    goals: [
      "Log 6 volunteering hours this month",
      "Confirm next event shift",
      "Prepare session materials",
    ],
    eventTypes: [
      { title: "Volunteering shift", minutes: 180 },
      { title: "Session prep", minutes: 45 },
    ],
    guidance:
      "Volunteering shifts are usually fixed commitments. Flag any overlap rather than moving them silently.",
    wave: 2,
  },
  {
    slug: "open-source",
    name: "Open Source",
    shortName: "Open Source",
    tagline: "Issues, reviews and weekly contributions.",
    accent: "#06b6d4",
    icon: "code",
    protectedByDefault: false,
    goals: [
      "Land 2 pull requests this month",
      "Review one community PR each week",
      "Keep a weekly contribution slot",
    ],
    eventTypes: [
      { title: "Open source work", minutes: 120 },
      { title: "PR review", minutes: 45 },
    ],
    guidance:
      "Open source runs best in focused 2 hour blocks. Avoid fragmenting it into short slots.",
    wave: 2,
  },
  {
    slug: "food",
    name: "Food",
    shortName: "Food",
    tagline: "Meals, prep and planning.",
    accent: "#f97316",
    icon: "food",
    protectedByDefault: true,
    goals: ["Keep three sit-down meals each day", "Plan next week's meals", "Prep two batch meals"],
    eventTypes: [
      { title: "Lunch", minutes: 60 },
      { title: "Dinner", minutes: 60 },
      { title: "Meal prep", minutes: 90 },
    ],
    guidance:
      "Meals are protected time. Never shorten or overwrite a meal without explicit confirmation.",
    wave: 2,
  },
  {
    slug: "sleep",
    name: "Sleep",
    shortName: "Sleep",
    tagline: "Bedtime, wind-down and recovery.",
    accent: "#4338ca",
    icon: "moon",
    protectedByDefault: true,
    goals: ["Sleep 7.5+ hours nightly", "Wind down 30 minutes before bed", "Wake at a consistent time"],
    eventTypes: [
      { title: "Sleep", minutes: 480 },
      { title: "Wind down", minutes: 30 },
    ],
    guidance:
      "Sleep is sacred. If a requested change cuts a night below 7 hours, warn the user and ask before saving.",
    wave: 1,
  },
  {
    slug: "karate",
    name: "Karate",
    shortName: "Karate",
    tagline: "Train, improve, excel.",
    accent: "#f43f5e",
    icon: "swords",
    protectedByDefault: true,
    goals: [
      "Attend 3 sessions this week",
      "Improve kata form",
      "Prepare for the next grading",
    ],
    eventTypes: [
      { title: "Karate training", minutes: 90 },
      { title: "Conditioning", minutes: 45 },
      { title: "Grading", minutes: 120, priorities: "high" },
    ],
    guidance:
      "Karate sessions are recurring and protected. Moving one should be confirmed and never deleted silently.",
    wave: 1,
  },
  {
    slug: "blogging",
    name: "Blogging",
    shortName: "Blogging",
    tagline: "Idea to draft to published.",
    accent: "#d946ef",
    icon: "pen",
    protectedByDefault: false,
    goals: ["Publish two posts this month", "Keep a weekly drafting slot", "Grow the draft backlog to five ideas"],
    eventTypes: [
      { title: "Blog draft", minutes: 90 },
      { title: "Editing pass", minutes: 45 },
    ],
    guidance: "Writing needs one uninterrupted block. Avoid scheduling other work inside a draft slot.",
    wave: 2,
  },
  {
    slug: "learning",
    name: "Learning",
    shortName: "Learning",
    tagline: "Skills, roadmaps and deliberate practice.",
    accent: "#8b5cf6",
    icon: "brain",
    protectedByDefault: false,
    goals: ["Practice daily for 45 minutes", "Finish the current course module", "Ship one practice project"],
    eventTypes: [
      { title: "Learning block", minutes: 45 },
      { title: "Practice project", minutes: 90 },
    ],
    guidance: "Learning compounds daily — prefer a consistent daily slot over long weekly marathons.",
    wave: 2,
  },
  {
    slug: "planning",
    name: "Forward Planning",
    shortName: "Planning",
    tagline: "Weekly review, monthly goals, yearly direction.",
    accent: "#6d28d9",
    icon: "compass",
    protectedByDefault: true,
    goals: ["Run a Sunday review every week", "Set three monthly goals", "Revisit the yearly direction monthly"],
    eventTypes: [
      { title: "Weekly review", minutes: 45 },
      { title: "Monthly planning", minutes: 60 },
    ],
    guidance:
      "Planning sessions are where the user decides, not where work happens. Keep the slot quiet and uninterrupted.",
    wave: 2,
  },
  {
    slug: "rest",
    name: "Rest & Buffer",
    shortName: "Rest",
    tagline: "Downtime and slack between blocks.",
    accent: "#14b8a6",
    icon: "armchair",
    protectedByDefault: true,
    goals: ["Keep buffer between back-to-back blocks", "Take one full rest evening weekly", "Protect weekend mornings"],
    eventTypes: [
      { title: "Rest & buffer", minutes: 60 },
      { title: "Deep rest", minutes: 120 },
    ],
    guidance:
      "Buffer time prevents burnout. Never fill a rest block without confirming, and keep 15 minutes between focus blocks.",
    wave: 2,
  },
  {
    slug: "finance",
    name: "Finance",
    shortName: "Finance",
    tagline: "Budgets, prizes and payment deadlines.",
    accent: "#22c55e",
    icon: "wallet",
    protectedByDefault: false,
    goals: ["Review monthly budget", "Track scholarship and prize deadlines", "Set up one payment reminder"],
    eventTypes: [
      { title: "Finance review", minutes: 45 },
      { title: "Payment deadline", minutes: 30, priorities: "high" },
    ],
    guidance: "Payment and scholarship deadlines are hard dates — never move them without asking.",
    wave: 2,
  },
  {
    slug: "admin",
    name: "Admin",
    shortName: "Admin",
    tagline: "Forms, fees, renewals.",
    accent: "#0ea5e9",
    icon: "clipboard",
    protectedByDefault: false,
    goals: ["Clear the form backlog", "Renew documents before expiry", "Batch admin into one weekly slot"],
    eventTypes: [
      { title: "Admin batch", minutes: 45 },
      { title: "Form deadline", minutes: 30, priorities: "high" },
    ],
    guidance: "Admin is easy to defer — always give it a concrete slot with a deadline attached.",
    wave: 2,
  },
  {
    slug: "social",
    name: "Social & Mentors",
    shortName: "Social",
    tagline: "Family, friends and mentors.",
    accent: "#ec4899",
    icon: "users",
    protectedByDefault: false,
    goals: ["Check in with a mentor monthly", "Plan one family call each week", "Keep one social evening free"],
    eventTypes: [
      { title: "Family time", minutes: 120 },
      { title: "Mentor catch-up", minutes: 45 },
      { title: "Friends", minutes: 120 },
    ],
    guidance: "Relationships need recurring time. Suggest a standing slot when the user mentions someone repeatedly.",
    wave: 2,
  },
  {
    slug: "portfolio",
    name: "Portfolio",
    shortName: "Portfolio",
    tagline: "Projects, certificates, achievements.",
    accent: "#94a3b8",
    icon: "folder",
    protectedByDefault: false,
    goals: ["Add two projects with write-ups", "Collect certificates in one place", "Refresh the portfolio quarterly"],
    eventTypes: [
      { title: "Portfolio update", minutes: 45 },
      { title: "Project write-up", minutes: 60 },
    ],
    guidance: "Portfolio work is best done right after a project ships, while the details are fresh.",
    wave: 2,
  },
  {
    slug: "travel",
    name: "Travel & Commute",
    shortName: "Travel",
    tagline: "Buffers between places.",
    accent: "#84cc16",
    icon: "plane",
    protectedByDefault: false,
    goals: ["Always leave a commute buffer", "Book travel two weeks ahead", "Keep a go-bag ready"],
    eventTypes: [
      { title: "Commute", minutes: 30 },
      { title: "Travel", minutes: 120 },
    ],
    guidance:
      "Never schedule two in-person commitments back-to-back in different places without a commute buffer.",
    wave: 2,
  },
  {
    slug: "habits",
    name: "Habits & Reflection",
    shortName: "Habits",
    tagline: "Daily check-in, streaks, energy.",
    accent: "#eab308",
    icon: "sparkles",
    protectedByDefault: true,
    goals: ["Daily evening check-in", "Keep the reflection streak alive", "Note mood and energy each day"],
    eventTypes: [
      { title: "Habit check-in", minutes: 15 },
      { title: "Reflection", minutes: 20 },
    ],
    guidance: "Check-ins should be short and daily. Never bundle them into a long weekly session.",
    wave: 2,
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

export function isDomainSlug(value: string): value is DomainSlug {
  return (DOMAIN_SLUGS as readonly string[]).includes(value);
}
