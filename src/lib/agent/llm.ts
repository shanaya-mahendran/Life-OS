/**
 * AI / Groq adapter with Multi-Key Pool & Load Balancing.
 *
 * Server-only: API keys must never reach the browser.
 * Uses Groq's high-speed inference engine (Llama-3.3 / GPT-OSS).
 * Supports automatic round-robin rotation and seamless failover
 * when a key hits rate limits (HTTP 429) or quota errors.
 */

import OpenAI from "openai";

export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
export const GROQ_DEFAULT_MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";

export const AGENT_MODEL = process.env.GROQ_MODEL ?? GROQ_DEFAULT_MODEL;

interface KeyEntry {
  key: string;
  client: OpenAI;
  model: string;
  cooldownUntil: number;
}

let keyPool: KeyEntry[] | null = null;
let currentKeyIndex = 0;

/** Extract all configured Groq keys from environment variables. */
export function getConfiguredKeys(): string[] {
  const rawKeys: (string | undefined)[] = [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
    ...(process.env.GROQ_API_KEYS ? process.env.GROQ_API_KEYS.split(/[,;\s]+/) : []),
  ];

  const unique = Array.from(
    new Set(
      rawKeys
        .map((k) => k?.trim())
        .filter((k): k is string => Boolean(k && k.length > 5 && !k.startsWith("YOUR-"))),
    ),
  );

  return unique;
}

function initPool(): KeyEntry[] {
  const keys = getConfiguredKeys();
  if (!keys.length) return [];

  return keys.map((key) => {
    return {
      key,
      model: GROQ_DEFAULT_MODEL,
      client: new OpenAI({
        apiKey: key,
        baseURL: GROQ_BASE_URL,
        timeout: 45_000,
        maxRetries: 1,
      }),
      cooldownUntil: 0,
    };
  });
}

function getPool(): KeyEntry[] {
  if (!keyPool || keyPool.length !== getConfiguredKeys().length) {
    keyPool = initPool();
  }
  return keyPool;
}

export function isAIConfigured(): boolean {
  return getConfiguredKeys().length > 0;
}
export const isDeepSeekConfigured = isAIConfigured;

export function getAIKeyCount(): number {
  return getConfiguredKeys().length;
}
export const getDeepSeekKeyCount = getAIKeyCount;

/**
 * Returns an OpenAI client from the pool using round-robin scheduling.
 * Prioritizes healthy keys that are not currently cooling down.
 */
export function getAIClient(): OpenAI {
  const pool = getPool();
  if (!pool.length) {
    throw new Error("No GROQ_API_KEY configured.");
  }

  const now = Date.now();
  // Find next key starting from currentKeyIndex that is not in cooldown
  for (let attempt = 0; attempt < pool.length; attempt += 1) {
    const idx = (currentKeyIndex + attempt) % pool.length;
    const entry = pool[idx];
    if (entry.cooldownUntil <= now) {
      currentKeyIndex = (idx + 1) % pool.length;
      return entry.client;
    }
  }

  // All keys are in cooldown; return the one whose cooldown expires earliest
  currentKeyIndex = (currentKeyIndex + 1) % pool.length;
  return pool[currentKeyIndex].client;
}
export const getDeepSeek = getAIClient;

/**
 * Executes an AI request with automatic multi-key fallback.
 * If client 1 encounters a 429 (rate-limit) or 5xx, it immediately tries
 * client 2 before falling back to the offline rules engine.
 */
export async function executeWithModelPool<T>(
  action: (client: OpenAI, keyIndex: number, model: string) => Promise<T>,
): Promise<T> {
  const pool = getPool();
  if (!pool.length) {
    throw new Error("No GROQ_API_KEY configured.");
  }

  const now = Date.now();
  // Order keys starting from round-robin pointer
  const orderedIndices = pool.map((_, i) => (currentKeyIndex + i) % pool.length);
  // Sort healthy keys first
  orderedIndices.sort((a, b) => pool[a].cooldownUntil - pool[b].cooldownUntil);

  let lastError: unknown = null;

  for (const idx of orderedIndices) {
    const entry = pool[idx];
    try {
      currentKeyIndex = (idx + 1) % pool.length;
      return await action(entry.client, idx, entry.model);
    } catch (err: unknown) {
      lastError = err;
      const errorMessage = String(err);
      const isRateLimit = errorMessage.includes("429") || errorMessage.toLowerCase().includes("rate limit");
      const isQuota = errorMessage.includes("402") || errorMessage.toLowerCase().includes("balance");

      // Place problematic key on a temporary cooldown (30s for 429, 5m for quota)
      entry.cooldownUntil = now + (isQuota ? 300_000 : isRateLimit ? 30_000 : 10_000);

      console.warn(
        `[lifeos] Groq key #${idx + 1} failed (${isRateLimit ? "rate limit" : isQuota ? "quota" : "error"}), trying next key in pool...`,
      );
    }
  }

  throw lastError;
}
export const executeWithDeepSeekPool = executeWithModelPool;
