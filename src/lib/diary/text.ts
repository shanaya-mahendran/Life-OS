/**
 * Pure Diary Mode helpers.
 *
 * Nothing in this module touches the database or the network, so every rule
 * below is testable: distress detection, the spark rotation, the lexical
 * "echo" similarity behind Blind Spot reminders, and the metadata-only digest
 * the weekly trend job reads.
 */

import { DISTRESS_PATTERNS, SPARK_BANK, SPARK_COOLDOWN_DAYS } from "./constants";

/* -------------------------------------------------------------------------- */
/* Safety                                                                     */
/* -------------------------------------------------------------------------- */

/** True when the text mentions serious distress or self-harm. Never logged. */
export function detectDistress(text: string): boolean {
  if (!text) return false;
  return DISTRESS_PATTERNS.some((pattern) => pattern.test(text));
}

/* -------------------------------------------------------------------------- */
/* Sparks                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Deterministic spark for a day, skipping anything used in the last
 * SPARK_COOLDOWN_DAYS days. Returns null when every prompt is on cooldown.
 */
export function pickSpark(dayIndex: number, recentSparks: string[] = []): string | null {
  const recent = new Set(recentSparks.filter(Boolean));
  const total = SPARK_BANK.length;

  for (let offset = 0; offset < total; offset += 1) {
    const candidate = SPARK_BANK[(Math.abs(dayIndex) + offset) % total];
    if (!recent.has(candidate)) return candidate;
  }

  return null;
}

export function sparkCooldownDays(): number {
  return SPARK_COOLDOWN_DAYS;
}

/* -------------------------------------------------------------------------- */
/* Echoes (Blind Spot reminders)                                              */
/* -------------------------------------------------------------------------- */

const STOPWORDS = new Set([
  "the", "and", "that", "this", "with", "have", "from", "they", "were", "been", "what", "when", "which",
  "about", "after", "before", "because", "just", "like", "really", "very", "today", "your", "yours", "you",
  "today's", "some", "then", "than", "them", "there", "here", "into", "over", "also", "more", "most", "much",
  "would", "could", "should", "still", "only", "even", "feel", "felt", "feels", "been", "being", "did", "does",
  "for", "but", "not", "are", "was", "will", "its", "it's", "our", "out", "get", "got", "one", "two", "all",
  "can", "how", "why", "who", "didn", "don", "doesn", "wasn", "weren", "ain", "had", "has", "him", "her", "his",
  "she", "they", "them", "their", "i'm", "i've", "i'd", "i'll", "it's", "that's",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, " ")
    .split(/\s+/)
    .map((word) => word.replace(/^'+|'+$/g, ""))
    .filter((word) => word.length >= 4 && !STOPWORDS.has(word));
}

/** Jaccard overlap of content words, 0–1. Cheap, deterministic, no API cost. */
export function lexicalSimilarity(a: string, b: string): number {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  if (!setA.size || !setB.size) return 0;

  let shared = 0;
  for (const word of setA) {
    if (setB.has(word)) shared += 1;
  }

  return shared / (setA.size + setB.size - shared);
}

/** The most similar older entry above the threshold, or null. */
export function bestEcho<T extends { id: string; body: string }>(
  current: string,
  candidates: T[],
  threshold = 0.16,
): { entry: T; score: number } | null {
  let best: { entry: T; score: number } | null = null;

  for (const candidate of candidates) {
    const score = lexicalSimilarity(current, candidate.body);
    if (score >= threshold && (!best || score > best.score)) {
      best = { entry: candidate, score };
    }
  }

  return best;
}

/* -------------------------------------------------------------------------- */
/* Trend digest                                                               */
/* -------------------------------------------------------------------------- */

export interface DiaryMetaRow {
  entryDate: string;
  createdAt: Date;
  bodyLength: number;
  tags: string[];
  stamps: string[];
  colors: string[];
}

/**
 * Builds a text digest of *metadata only* for the weekly trend call. Entry
 * bodies are never included — that is the privacy promise of the trend job.
 */
export function buildTrendDigest(rows: DiaryMetaRow[], timeZone: string): string {
  if (!rows.length) return "";

  const byMonth = new Map<string, DiaryMetaRow[]>();
  for (const row of rows) {
    const key = row.entryDate.slice(0, 7);
    const list = byMonth.get(key) ?? [];
    list.push(row);
    byMonth.set(key, list);
  }

  const lines: string[] = [`Timezone: ${timeZone}. Entries analysed: ${rows.length}. Metadata only — no entry text.`];

  for (const [month, list] of [...byMonth.entries()].sort()) {
    const lengths = list.map((row) => row.bodyLength);
    const average = Math.round(lengths.reduce((sum, value) => sum + value, 0) / lengths.length);
    const longest = list.reduce((max, row) => Math.max(max, row.bodyLength), 0);
    const tagCounts = countAll(list.flatMap((row) => row.tags));
    const stampCounts = countAll(list.flatMap((row) => row.stamps));
    const colorCounts = countAll(list.flatMap((row) => row.colors));
    const hours = list.map((row) => localHour(row.createdAt, timeZone));
    const evening = hours.filter((hour) => hour >= 19 || hour < 3).length;

    lines.push(
      `${month}: ${list.length} entries, average ${average} chars, longest ${longest} chars, ` +
        `${evening} written late evening. ` +
        `Tags: ${top(tagCounts, 4)}. Stamps: ${top(stampCounts, 5)}. Colors: ${top(colorCounts, 3)}.`,
    );
  }

  return lines.join("\n");
}

function countAll(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function top(counts: Map<string, number>, limit: number): string {
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  return sorted.length ? sorted.map(([value, count]) => `${value}(${count})`).join(", ") : "none";
}

export function localHour(date: Date, timeZone: string): number {
  try {
    return Number(
      new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", hour12: false }).format(date).replace(/\D/g, ""),
    );
  } catch {
    return date.getUTCHours();
  }
}

/* -------------------------------------------------------------------------- */
/* Ambient palette                                                            */
/* -------------------------------------------------------------------------- */

/** Accepts only safe `#rrggbb` values so a model can never inject CSS. */
export function parsePalette(value: unknown, fallback: readonly [string, string]): [string, string] {
  if (!Array.isArray(value)) return [fallback[0], fallback[1]];

  const colors = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().match(/^#([0-9a-f]{6})$/i)?.[0])
    .filter((item): item is string => Boolean(item));

  if (colors.length < 2) return [fallback[0], fallback[1]];
  return [colors[0], colors[1]];
}

export function gradientStyle(colors: [string, string]): { background: string } {
  return {
    background: `linear-gradient(150deg, ${colors[0]} 0%, ${colors[1]} 55%, #08050f 100%)`,
  };
}

/** Rough reading time for the editor footer. */
export function readingMinutes(length: number): number {
  return Math.max(1, Math.round(length / 900));
}
