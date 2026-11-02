/**
 * Diary Mode constants shared by the service layer, the API routes and the UI.
 *
 * Everything that the engine and the screens must agree on lives here: the
 * accent, the deep-mode names, the persona prompts, the gradients used when the
 * ambient layer has nothing to show, and the local spark fallbacks.
 */

export const DIARY_ACCENT = "#f59e0b";
export const DIARY_ACCENT_SOFT = "#fbbf24";

/** Ambient gradient used whenever no palette has been produced yet. */
export const NEUTRAL_GRADIENT = ["#1b1430", "#0b0718"] as const;

export const MAX_SESSION_TURNS = 6;
export const MAX_ENTRY_CHARS = 20_000;
export const MAX_TAGS = 8;
export const SPARK_COOLDOWN_DAYS = 14;

/** Deep modes. Each one is opt-in and bounded. */
export type DiaryMode = "alter_ego" | "devils_advocate" | "collaborator";

export const MODE_META: Record<
  DiaryMode,
  { label: string; blurb: string; turns: number; accent: string }
> = {
  alter_ego: {
    label: "Alter-ego",
    blurb: "Talk with a historical or future mirror. It asks more than it tells.",
    turns: MAX_SESSION_TURNS,
    accent: "#a78bfa",
  },
  devils_advocate: {
    label: "Devil's Advocate",
    blurb: "Two lines per thinking trap: what it noticed, and a gentler question.",
    turns: 2,
    accent: "#fb7185",
  },
  collaborator: {
    label: "Creative Collaborator",
    blurb: "Three seeds — a twist, a missing detail, an artistic reference.",
    turns: 2,
    accent: "#34d399",
  },
};

export interface Persona {
  id: string;
  name: string;
  tagline: string;
  /** Kept short — this is a creative mirror, not a character role-play. */
  prompt: string;
}

export const PERSONAS: Persona[] = [
  {
    id: "stoic",
    name: "The Stoic",
    tagline: "Marcus Aurelius, in a rainy atrium",
    prompt:
      "You are a Stoic philosopher in the tradition of Marcus Aurelius and Epictetus. Ask more than you assert. " +
      "Quote the writer's own words back to them before responding. Focus on what is within their control and on the " +
      "gap between an event and their judgement of it. Ask one question at a time. Never diagnose, never advise on " +
      "money, health or law. Keep every reply under 90 words.",
  },
  {
    id: "artist",
    name: "The Renaissance Artist",
    tagline: "A studio, a half-finished fresco, patience",
    prompt:
      "You are a Renaissance artist and teacher. Ask more than you assert. Quote the writer's own words back before " +
      "responding. Look for image, texture, light and unfinished work in what they wrote, and ask what they would " +
      "keep and what they would paint over. Ask one question at a time. Keep every reply under 90 words.",
  },
  {
    id: "futurist",
    name: "You at 60",
    tagline: "A kinder, older version of yourself",
    prompt:
      "You are the writer at sixty, looking back with warmth and no smugness. Ask more than you assert. Quote their " +
      "words back before responding. Never predict markets, outcomes or events; never give financial or health " +
      "advice. Speak from lived hindsight only. Ask one question at a time. Keep every reply under 90 words.",
  },
  {
    id: "editor",
    name: "The Blunt Editor",
    tagline: "Red pen, no cruelty",
    prompt:
      "You are a blunt but fair editor. Quote the writer's words back before responding. Point at one vague phrase " +
      "and ask what it actually means, then ask what the piece is really about. Never insult the writer, never " +
      "score them. Ask one question at a time. Keep every reply under 90 words.",
  },
  {
    id: "mentor",
    name: "The Gentle Mentor",
    tagline: "Someone who has time for you",
    prompt:
      "You are a gentle mentor. Quote the writer's words back before responding. Name one strength you can actually " +
      "see in the writing, then ask one small question that makes the next step easier. Never diagnose, never give " +
      "medical or financial advice. Keep every reply under 90 words.",
  },
];

export function personaById(id: string): Persona {
  return PERSONAS.find((persona) => persona.id === id) ?? PERSONAS[0];
}

/* -------------------------------------------------------------------------- */
/* Spark fallbacks                                                            */
/* -------------------------------------------------------------------------- */

/** Used when the ambient layer is off or unavailable — never repeats in 14 days. */
export const SPARK_BANK = [
  "If your morning had a movie title, what would it be?",
  "Write today's entry entirely in fragments or single words.",
  "What is one thing you noticed today that nobody else would have?",
  "Describe today's weather as if it were a person you met.",
  "What did you almost say out loud today, and to whom?",
  "List three sounds from today, in the order you heard them.",
  "What would you keep from this week if you could only keep one hour?",
  "Write about today from the point of view of an object in the room.",
  "What is the smallest thing that went right today?",
  "If today were a room, what would be on the walls?",
  "What are you pretending not to be tired about?",
  "Write one sentence you would want to read in a year.",
  "What did you resist today, and what did the resisting feel like?",
  "Who crossed your mind today without being mentioned?",
] as const;

/* -------------------------------------------------------------------------- */
/* Safety                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * A deliberately small, high-precision list. The goal is to stop the ambient
 * layer and offer support, never to triage or label anyone. Matched text is
 * never logged.
 */
export const DISTRESS_PATTERNS = [
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

export const SUPPORT_MESSAGE =
  "You wrote something heavy, and that matters more than any feature here. The AI features are paused for today. " +
  "If you are in danger, please contact your local emergency number, or reach a crisis line in your country " +
  "(findahelpline.com lists them). Nothing you wrote has been sent to a model.";

export const SAFETY_FOOTER =
  "A diary mirror, not a therapist. Nothing here diagnoses, scores or advises. Every AI feature can be switched off.";

/** Ambient gradients offered when the model is unavailable, keyed by length. */
export function fallbackGradient(seed: number): [string, string] {
  const palettes: [string, string][] = [
    ["#1c1a3d", "#0a0817"],
    ["#2a1730", "#0b0714"],
    ["#14232f", "#080e16"],
    ["#2a2317", "#100b06"],
  ];
  return palettes[Math.abs(seed) % palettes.length];
}
