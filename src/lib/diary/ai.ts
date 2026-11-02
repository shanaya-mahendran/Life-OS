/**
 * Diary Mode AI layer (server-only).
 *
 * Two rules shape this file:
 *  1. The ambient layer is one small structured call per entry, cached. If it
 *     fails, the caller falls back to a neutral gradient — an entry is never
 *     blocked by the model.
 *  2. Nothing here ever logs entry text. Usage is recorded on AgentLog with a
 *     feature label only, so the monthly budget stays honest without keeping a
 *     second copy of the diary.
 */

import { prisma } from "@/lib/db";
import { AGENT_MODEL, executeWithModelPool, isAIConfigured } from "@/lib/agent/llm";
import { PERSONAS, personaById } from "./constants";

export interface AmbientResult {
  hexColors: [string, string];
  emojiStamps: [string, string, string];
  oneLineReframing: string;
  spark: string;
}

export interface AdvocatePattern {
  quote: string;
  question: string;
}

export interface CollaboratorSeed {
  kind: "twist" | "detail" | "reference";
  text: string;
}

const DIARY_MODEL = process.env.DIARY_MODEL ?? AGENT_MODEL;

export function diaryAiConfigured(): boolean {
  return isAIConfigured();
}

function hex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^#?([0-9a-f]{6})$/i);
  return match ? `#${match[1].toLowerCase()}` : null;
}

/** Record token spend without ever persisting the text that was sent. */
async function recordUsage(userId: string, feature: string, usage?: { prompt_tokens?: number; completion_tokens?: number }) {
  try {
    await prisma.agentLog.create({
      data: {
        userId,
        message: `diary:${feature}`,
        intent: "diary",
        engine: "diary",
        tokensIn: usage?.prompt_tokens ?? 0,
        tokensOut: usage?.completion_tokens ?? 0,
      },
    });
  } catch (error) {
    console.warn("[lifeos] diary usage log failed", error);
  }
}

async function complete(
  userId: string,
  feature: string,
  system: string,
  user: string,
  options: { json: boolean; maxTokens?: number; temperature?: number },
): Promise<string | null> {
  if (!diaryAiConfigured()) return null;

  try {
    return await executeWithModelPool(async (client, _index, _model) => {
      // Structured calls ask for raw JSON in the prompt rather than using
      // `response_format`: reasoning models on the free tier truncate or wrap
      // the object, and a truncated object fails provider-side validation.
      const response = await client.chat.completions.create({
        model: DIARY_MODEL,
        temperature: options.temperature ?? 0.6,
        max_tokens: options.maxTokens ?? 500,
        messages: [
          { role: "system", content: system },
          { role: "user", content: options.json ? `${user}\n\nRespond with raw JSON only. No prose, no code fences.` : user },
        ],
      });

      void recordUsage(userId, feature, response.usage ?? undefined);
      return response.choices[0]?.message?.content?.trim() ?? null;
    });
  } catch (error) {
    console.warn(`[lifeos] diary ${feature} call failed`, error instanceof Error ? error.message : error);
    return null;
  }
}

function parseJson(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;

  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
  const candidates = [cleaned];
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) candidates.push(cleaned.slice(start, end + 1));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // try the next candidate
    }
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Layer 1 — ambient                                                          */
/* -------------------------------------------------------------------------- */

const AMBIENT_SYSTEM = `You are a silent design engine inside a private journal. You never speak to the writer.
Return ONE JSON object with exactly these keys:
- "hexColors": array of exactly 2 lowercase hex strings, a complementary pair that matches the mood of the entry (dark-friendly; both are used as a gradient).
- "emojiStamps": array of exactly 3 single emoji characters for objects or vibes actually mentioned.
- "oneLineReframing": one sentence under 10 words naming a silver lining or a creative win. No advice, no diagnosis, no praise of the writer's character.
- "spark": one short, concrete writing prompt for tomorrow, under 18 words, never a repeat of the entry's topic.
No prose outside the JSON. If the entry is too short, still return all four keys.`;

export async function runAmbient(
  userId: string,
  body: string,
  context: { timeOfDay: string; recentSparks: string[] },
): Promise<AmbientResult | null> {
  const trimmed = body.trim();
  if (trimmed.length < 12) return null;

  const recent = context.recentSparks.filter(Boolean).slice(0, 8);
  const raw = await complete(
    userId,
    "ambient",
    AMBIENT_SYSTEM,
    [
      `Time of day: ${context.timeOfDay}.`,
      recent.length ? `Do not repeat these earlier prompts: ${recent.join(" | ")}` : "",
      "Entry:",
      trimmed.slice(0, 6000),
    ]
      .filter(Boolean)
      .join("\n"),
    { json: true, maxTokens: 900, temperature: 0.7 },
  );

  const data = parseJson(raw);
  if (!data) return null;

  const colors = Array.isArray(data.hexColors)
    ? data.hexColors.map(hex).filter((value): value is string => Boolean(value))
    : [];
  const stamps = Array.isArray(data.emojiStamps)
    ? data.emojiStamps
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter((value) => value.length > 0 && value.length <= 8)
        .slice(0, 3)
    : [];
  const reframing = typeof data.oneLineReframing === "string" ? data.oneLineReframing.trim().slice(0, 140) : "";
  const spark = typeof data.spark === "string" ? data.spark.trim().slice(0, 180) : "";

  if (colors.length < 2 || stamps.length < 3) return null;

  return {
    hexColors: [colors[0], colors[1]],
    emojiStamps: [stamps[0], stamps[1], stamps[2]],
    oneLineReframing: reframing,
    spark,
  };
}

/* -------------------------------------------------------------------------- */
/* Layer 2 — deep modes                                                       */
/* -------------------------------------------------------------------------- */

export async function personaReply(
  userId: string,
  params: { personaId: string; entryText: string; turns: { role: "user" | "coach"; content: string }[] },
): Promise<string | null> {
  const persona = personaById(params.personaId);
  const history = params.turns
    .map((turn) => `${turn.role === "user" ? "Writer" : persona.name}: ${turn.content}`)
    .join("\n");

  return complete(
    userId,
    "session",
    `${persona.prompt}\nReturn plain prose only — no headings, no lists, no JSON. ` +
      `You are a creative mirror, not a real person and not a professional of any kind. ` +
      `Never mention being an AI model. Never give medical, mental-health, legal or financial advice. ` +
      `If the writer raises self-harm or crisis, stop the exercise, say you are pausing, and suggest a support line.`,
    [`The entry they wrote:`, params.entryText.slice(0, 4000), ``, `Conversation so far:`, history || "(none — open the session)"]
      .join("\n"),
    { json: false, maxTokens: 240, temperature: 0.7 },
  );
}

const ADVOCATE_SYSTEM = `You look for logged thinking traps in a journal entry: catastrophizing, black-and-white thinking, mind-reading, fortune-telling, labelling, should-statements.
Return ONE JSON object: { "patterns": [ { "quote": string, "question": string } ] } with at most 3 patterns.
"quote" must be copied verbatim from the entry (max 20 words). "question" is a gentler alternative framing, phrased as a question, under 25 words.
Never argue, never diagnose, never give advice. If you find no clear pattern, return { "patterns": [] }.`;

export async function advocatePass(userId: string, entryText: string): Promise<AdvocatePattern[] | null> {
  const raw = await complete(userId, "advocate", ADVOCATE_SYSTEM, entryText.slice(0, 5000), {
    json: true,
    maxTokens: 900,
    temperature: 0.4,
  });
  const data = parseJson(raw);
  if (!data || !Array.isArray(data.patterns)) return null;

  return data.patterns
    .map((item) => {
      const record = item as Record<string, unknown>;
      return {
        quote: typeof record.quote === "string" ? record.quote.trim().slice(0, 200) : "",
        question: typeof record.question === "string" ? record.question.trim().slice(0, 240) : "",
      };
    })
    .filter((item) => item.quote && item.question)
    .slice(0, 3);
}

const COLLABORATOR_SYSTEM = `You help expand a half-formed idea in a private journal.
Return ONE JSON object: { "seeds": [ { "kind": "twist" | "detail" | "reference", "text": string } ] } with exactly 3 seeds, one of each kind.
"twist" is a plot or argument turn, "detail" is a concrete missing detail, "reference" names a real book, film, painting, album or idea.
Each text is under 30 words, offers rather than instructs, and never claims the writer must do anything.`;

export async function collaboratorSeeds(userId: string, entryText: string): Promise<CollaboratorSeed[] | null> {
  const raw = await complete(userId, "collaborator", COLLABORATOR_SYSTEM, entryText.slice(0, 5000), {
    json: true,
    maxTokens: 900,
    temperature: 0.85,
  });
  const data = parseJson(raw);
  if (!data || !Array.isArray(data.seeds)) return null;

  const allowed: CollaboratorSeed["kind"][] = ["twist", "detail", "reference"];
  const seeds = data.seeds
    .map((item) => {
      const record = item as Record<string, unknown>;
      const kind = typeof record.kind === "string" ? record.kind.trim().toLowerCase() : "";
      const text = typeof record.text === "string" ? record.text.trim().slice(0, 240) : "";
      return allowed.includes(kind as CollaboratorSeed["kind"]) ? { kind: kind as CollaboratorSeed["kind"], text } : null;
    })
    .filter((item): item is CollaboratorSeed => Boolean(item && item.text));

  return seeds.length ? seeds.slice(0, 3) : null;
}

/* -------------------------------------------------------------------------- */
/* Burn Diary                                                                 */
/* -------------------------------------------------------------------------- */

const BURN_SYSTEM = `A person is venting and their words will be permanently deleted the moment you answer.
Return only 1–2 sentences, under 45 words total: validation, or a single profound takeaway from what they carried.
Never analyse, never list, never diagnose, never advise, never ask a question. Do not quote the text. Plain prose only.`;

export async function burnTakeaway(userId: string, text: string): Promise<string | null> {
  const reply = await complete(userId, "burn", BURN_SYSTEM, text.slice(0, 6000), {
    json: false,
    maxTokens: 400,
    temperature: 0.5,
  });
  if (!reply) return null;
  return reply.replace(/^["']|["']$/g, "").trim().slice(0, 400) || null;
}

/* -------------------------------------------------------------------------- */
/* Monthly story                                                              */
/* -------------------------------------------------------------------------- */

const STORY_SYSTEM = `You write a short, stylised monthly fable (160–220 words) from scattered journal notes.
Rules: third person, mythic and warm, clearly fictionalised. Invent no real names, places, companies or identifying details — use "the traveller", "the workshop", "the city" instead.
Never quote the notes verbatim, never diagnose, never advise. End on an image, not a moral. Plain prose, no title, no headings.`;

export async function monthlyStory(userId: string, digest: string): Promise<string | null> {
  const reply = await complete(userId, "monthly_story", STORY_SYSTEM, digest.slice(0, 12_000), {
    json: false,
    maxTokens: 1400,
    temperature: 0.9,
  });
  return reply ? reply.trim().slice(0, 4000) : null;
}

/* -------------------------------------------------------------------------- */
/* Trend cards                                                                */
/* -------------------------------------------------------------------------- */

const TRENDS_SYSTEM = `You read aggregate metadata about three months of journaling — never the text itself.
Return ONE JSON object: { "cards": [ { "observation": string } ] } with 2 to 3 cards.
Each observation is one plain sentence under 28 words, phrased as a pattern you noticed and could be wrong about ("Your entries tend to…", "It looks like…").
No numbers you cannot see, no advice, no conclusions about the person, no diagnosis.`;

export async function trendCards(userId: string, digest: string): Promise<string[] | null> {
  const raw = await complete(userId, "trends", TRENDS_SYSTEM, digest.slice(0, 8000), {
    json: true,
    maxTokens: 900,
    temperature: 0.6,
  });
  const data = parseJson(raw);
  if (!data || !Array.isArray(data.cards)) return null;

  const cards = data.cards
    .map((item) => {
      const record = item as Record<string, unknown>;
      return typeof record.observation === "string" ? record.observation.trim().slice(0, 240) : "";
    })
    .filter(Boolean);

  return cards.length ? cards.slice(0, 3) : null;
}

export const DIARY_PERSONA_COUNT = PERSONAS.length;
