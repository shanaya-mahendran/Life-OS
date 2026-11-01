/**
 * Domain memory.
 *
 * DeepSeek exposes no embedding endpoint, so memories use a deterministic
 * hashed bag-of-words embedding and cosine ranking. It is lexical rather than
 * semantic, but it is instant, free, private and good enough to surface "the
 * 7pm karate class" when the user says "karate".
 */

import { prisma } from "@/lib/db";

const DIMENSIONS = 256;

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

function tokenize(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));

  const tokens = [...words];
  for (let index = 0; index < words.length - 1; index += 1) {
    tokens.push(`${words[index]}_${words[index + 1]}`);
  }
  return tokens;
}

export function embedText(text: string): number[] {
  const vector = new Array<number>(DIMENSIONS).fill(0);
  for (const token of tokenize(text)) {
    const hash = hashString(token);
    const position = hash % DIMENSIONS;
    const sign = hashString(`${token}:sign`) % 2 === 0 ? 1 : -1;
    vector[position] += sign;
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

export async function saveMemory(userId: string, domainSlug: string, note: string): Promise<string> {
  const domain = await prisma.domain.findFirst({ where: { userId, slug: domainSlug } });
  if (!domain) throw new Error(`Unknown domain "${domainSlug}".`);

  const memory = await prisma.memory.create({
    data: {
      userId,
      domainId: domain.id,
      note,
      embedding: embedText(note),
    },
  });
  return memory.id;
}

export async function recallMemories(
  userId: string,
  query: string,
  options: { domainSlug?: string; limit?: number } = {},
): Promise<{ note: string; score: number; domainSlug: string }[]> {
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

  const queryVector = embedText(query);
  return rows
    .map((row) => ({
      note: row.note,
      domainSlug: row.domain.slug,
      score: cosineSimilarity(queryVector, row.embedding as number[]),
    }))
    .filter((row) => row.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, options.limit ?? 5);
}

/** Compact memory block for the system prompt. */
export async function memoryContext(userId: string, query: string): Promise<string> {
  const memories = await recallMemories(userId, query, { limit: 6 });
  if (!memories.length) return "No stored notes yet.";
  return memories.map((memory) => `- [${memory.domainSlug}] ${memory.note}`).join("\n");
}
