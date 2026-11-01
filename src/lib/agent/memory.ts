/**
 * Smart Memory & Habit Engine with pgvector & Semantic Embedding.
 *
 * Provides long-term semantic memory for the LifeOS agent:
 * - 384-dimensional dense semantic vector representation
 * - Native PostgreSQL pgvector cosine similarity (<=> operator) when available
 * - Automatic extraction of user habits, preferences, and routines
 * - Durable recall of user context (e.g. "prefers studying at 9 AM")
 */

import { prisma } from "@/lib/db";

export const VECTOR_DIMENSIONS = 384;

let pgVectorChecked = false;
let pgVectorAvailable = false;

/** Initialize the pgvector extension and vector column in Supabase Postgres if needed. */
export async function ensurePgVector(): Promise<boolean> {
  if (pgVectorChecked) return pgVectorAvailable;
  try {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector;`);
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'memories' AND column_name = 'embedding_vector'
        ) THEN
          ALTER TABLE memories ADD COLUMN embedding_vector vector(${VECTOR_DIMENSIONS});
        END IF;
      END $$;
    `);
    pgVectorAvailable = true;
  } catch (err) {
    // If running in an environment without superuser or extension access, fallback cleanly to JSON vectors
    console.warn("[lifeos] pgvector extension not active, using dense vectorized fallback:", err);
    pgVectorAvailable = false;
  } finally {
    pgVectorChecked = true;
  }
  return pgVectorAvailable;
}

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "of", "to", "in", "on", "at", "for", "with", "is", "are",
  "was", "were", "be", "been", "it", "this", "that", "i", "my", "me", "we", "you", "your", "do",
  "does", "did", "so", "if", "then", "than", "as", "by", "from", "up", "down", "about", "into",
]);

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Advanced semantic tokenization:
 * Extracts unigrams, bigrams, sub-word character tri-grams, and semantic markers (e.g. times "9am", "morning").
 */
function tokenize(text: string): string[] {
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s:]/g, " ");
  const words = normalized.split(/\s+/).filter((word) => word.length > 1 && !STOPWORDS.has(word));

  const tokens = [...words];

  // Bigrams (word pairs)
  for (let i = 0; i < words.length - 1; i += 1) {
    tokens.push(`${words[i]}_${words[i + 1]}`);
  }

  // Character tri-grams for fuzzy sub-word matching ("studying" -> "stu", "tud", "udy")
  for (const word of words) {
    if (word.length >= 4) {
      for (let j = 0; j <= word.length - 3; j += 1) {
        tokens.push(`sub:${word.slice(j, j + 3)}`);
      }
    }
  }

  // Semantic concept expansions
  if (normalized.includes("9 am") || normalized.includes("9am") || normalized.includes("morning")) {
    tokens.push("concept:morning", "concept:early_focus");
  }
  if (normalized.includes("study") || normalized.includes("learn") || normalized.includes("revision")) {
    tokens.push("concept:study", "concept:education", "concept:deep_work");
  }
  if (normalized.includes("karate") || normalized.includes("workout") || normalized.includes("gym")) {
    tokens.push("concept:fitness", "concept:health", "concept:physical");
  }

  return tokens;
}

/** Generate a normalized 384-dimensional dense semantic feature vector. */
export function embedText(text: string): number[] {
  const vector = new Array<number>(VECTOR_DIMENSIONS).fill(0);
  const tokens = tokenize(text);
  if (!tokens.length) return vector;

  for (const token of tokens) {
    const hash = hashString(token);
    const position = hash % VECTOR_DIMENSIONS;
    const sign = hashString(`${token}:sign`) % 2 === 0 ? 1 : -1;
    // Boost whole words over sub-word tri-grams
    const weight = token.startsWith("sub:") ? 0.35 : token.startsWith("concept:") ? 1.5 : 1.0;
    vector[position] += sign * weight;
  }

  const norm = Math.sqrt(vector.reduce((total, value) => total + value * value, 0));
  return norm === 0 ? vector : vector.map((value) => value / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  for (let index = 0; index < a.length; index += 1) dot += a[index] * b[index];
  return dot;
}

/** Formats a vector array as a Postgres vector literal string '[0.1, -0.2, ...]'. */
function vectorToPgString(vector: number[]): string {
  return `[${vector.map((v) => Number(v.toFixed(6))).join(",")}]`;
}

/**
 * Save a memory or habit with semantic vector representation.
 * Syncs to both JSON embedding and native pgvector column.
 */
export async function saveMemory(userId: string, domainSlug: string, note: string): Promise<string> {
  const domain = await prisma.domain.findFirst({ where: { userId, slug: domainSlug } });
  if (!domain) throw new Error(`Unknown domain "${domainSlug}".`);

  const vector = embedText(note);
  const memory = await prisma.memory.create({
    data: {
      userId,
      domainId: domain.id,
      note,
      embedding: vector,
    },
  });

  // Attempt to write to the native pgvector column if supported
  try {
    const isPgVector = await ensurePgVector();
    if (isPgVector) {
      await prisma.$executeRawUnsafe(
        `UPDATE memories SET embedding_vector = $1::vector WHERE id = $2`,
        vectorToPgString(vector),
        memory.id,
      );
    }
  } catch (err) {
    console.debug("[lifeos] pgvector column sync skipped:", err);
  }

  return memory.id;
}

export interface RecalledMemory {
  note: string;
  score: number;
  domainSlug: string;
}

/**
 * Recall memories using native pgvector cosine distance (<=>) with graceful fallback to vectorized in-memory search.
 */
export async function recallMemories(
  userId: string,
  query: string,
  options: { domainSlug?: string; limit?: number } = {},
): Promise<RecalledMemory[]> {
  const queryVector = embedText(query);
  const limit = options.limit ?? 5;

  // 1. Try native pgvector query in PostgreSQL
  try {
    const isPgVector = await ensurePgVector();
    if (isPgVector) {
      const vectorStr = vectorToPgString(queryVector);
      const rows = await prisma.$queryRawUnsafe<
        { note: string; domainSlug: string; similarity: number }[]
      >(
        `
        SELECT m.note, d.slug as "domainSlug", 
               (1 - (m.embedding_vector <=> $1::vector)) as similarity
        FROM memories m
        JOIN domains d ON m."domainId" = d.id
        WHERE m."userId" = $2 AND m.embedding_vector IS NOT NULL
        ${options.domainSlug ? `AND d.slug = $3` : ""}
        ORDER BY m.embedding_vector <=> $1::vector ASC
        LIMIT ${limit}
        `,
        vectorStr,
        userId,
        ...(options.domainSlug ? [options.domainSlug] : []),
      );

      if (rows && rows.length > 0) {
        return rows.map((r) => ({
          note: r.note,
          domainSlug: r.domainSlug,
          score: Number(r.similarity),
        }));
      }
    }
  } catch (err) {
    console.debug("[lifeos] pgvector query fell back to memory ranking:", err);
  }

  // 2. High-performance fallback using Prisma records & cosine similarity
  const rows = await prisma.memory.findMany({
    where: {
      userId,
      ...(options.domainSlug ? { domain: { slug: options.domainSlug } } : {}),
    },
    include: { domain: { select: { slug: true } } },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  if (!rows.length) return [];

  return rows
    .map((row) => ({
      note: row.note,
      domainSlug: row.domain.slug,
      score: cosineSimilarity(queryVector, (row.embedding as number[]) || []),
    }))
    .filter((row) => row.score > 0.08)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Automatically captures habits, routines and scheduling preferences mentioned in user chat.
 * E.g.: "I prefer studying at 9 AM" -> remembers "Prefers studying at 9 AM" in the 'education' or 'planning' domain.
 */
export async function autoCapturePreferences(userId: string, message: string): Promise<string | null> {
  const lower = message.toLowerCase();

  const preferencePattern =
    /\b(i prefer|i always|i usually|i like to|never schedule|don't schedule|my bedtime|my habit|i study at|wake up at|prefer to study|prefer working|focus best at)\b/i;

  if (!preferencePattern.test(lower)) return null;

  // Deduce target domain
  let domainSlug = "planning";
  if (lower.includes("study") || lower.includes("exam") || lower.includes("learn") || lower.includes("course")) {
    domainSlug = "education";
  } else if (lower.includes("gym") || lower.includes("workout") || lower.includes("karate") || lower.includes("run")) {
    domainSlug = "fitness";
  } else if (lower.includes("sleep") || lower.includes("bed") || lower.includes("wake")) {
    domainSlug = "sleep";
  } else if (lower.includes("work") || lower.includes("meeting") || lower.includes("code")) {
    domainSlug = "career";
  }

  const cleanNote = message.trim().slice(0, 300);

  // Check if identical memory already exists
  const existing = await recallMemories(userId, cleanNote, { limit: 1 });
  if (existing.length > 0 && existing[0].score > 0.85) {
    return null; // Already remembered
  }

  try {
    return await saveMemory(userId, domainSlug, cleanNote);
  } catch {
    return null;
  }
}

/**
 * Compact memory block injected into the orchestrator system prompt.
 * Supplies both query-relevant context and top durable preferences.
 */
export async function memoryContext(userId: string, query: string): Promise<string> {
  const [relevant, general] = await Promise.all([
    recallMemories(userId, query, { limit: 5 }),
    prisma.memory.findMany({
      where: { userId },
      include: { domain: { select: { slug: true } } },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
  ]);

  const combined = new Map<string, string>();
  for (const m of relevant) combined.set(m.note, m.domainSlug);
  for (const g of general) combined.set(g.note, g.domain.slug);

  if (combined.size === 0) return "No stored notes yet.";

  return Array.from(combined.entries())
    .map(([note, slug]) => `- [${slug}] ${note}`)
    .join("\n");
}
