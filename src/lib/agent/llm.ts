/**
 * OpenAI-compatible provider adapter with multi-key failover.
 *
 * Server-only: API keys must never reach the browser.
 * Prefers OpenRouter when configured, then retains Groq as a fallback pool.
 * Keys rotate on each request and unhealthy keys enter a short cooldown.
 */

import OpenAI from "openai";

export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
export const GROQ_DEFAULT_MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";
export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
export const OPENROUTER_DEFAULT_MODEL = process.env.OPENROUTER_MODEL ?? "openai/gpt-4o";

interface ProviderCredential {
  key: string;
  provider: "OpenRouter" | "Groq";
  baseURL: string;
  model: string;
}

interface KeyEntry {
  key: string;
  provider: ProviderCredential["provider"];
  client: OpenAI;
  model: string;
  cooldownUntil: number;
}

let keyPool: KeyEntry[] | null = null;
let currentKeyIndex = 0;

function configuredProviderKeys(
  values: (string | undefined)[],
  provider: ProviderCredential["provider"],
  baseURL: string,
  model: string,
): ProviderCredential[] {
  const keys = values
    .flatMap((value) => value?.split(/[,;\s]+/) ?? [])
    .map((key) => key.trim())
    .filter((key) => key.length > 5 && !key.startsWith("YOUR-"));

  return [...new Set(keys)].map((key) => ({ key, provider, baseURL, model }));
}

function getConfiguredCredentials(): ProviderCredential[] {
  const openRouterKeys = configuredProviderKeys(
    [
      process.env.OPENROUTER_API_KEY,
      process.env.OPENROUTER_API_KEY_2,
      process.env.OPENROUTER_API_KEY_3,
      process.env.OPENROUTER_API_KEYS,
    ],
    "OpenRouter",
    OPENROUTER_BASE_URL,
    OPENROUTER_DEFAULT_MODEL,
  );
  const groqKeys = configuredProviderKeys(
    [
      process.env.GROQ_API_KEY,
      process.env.GROQ_API_KEY_2,
      process.env.GROQ_API_KEY_3,
      process.env.GROQ_API_KEYS,
    ],
    "Groq",
    GROQ_BASE_URL,
    GROQ_DEFAULT_MODEL,
  );
  return [...openRouterKeys, ...groqKeys];
}

/** Configured OpenRouter keys take precedence over the Groq key pool. */
export function getConfiguredKeys(): string[] {
  return getConfiguredCredentials().map(({ key }) => key);
}

function initPool(): KeyEntry[] {
  return getConfiguredCredentials().map(({ key, provider, baseURL, model }) => {
    return {
      key,
      provider,
      model,
      client: new OpenAI({
        apiKey: key,
        baseURL,
        ...(provider === "OpenRouter"
          ? {
              defaultHeaders: {
                "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://lifeos.app",
                "X-Title": "LifeOS",
              },
            }
          : {}),
        timeout: 45_000,
        maxRetries: 1,
      }),
      cooldownUntil: 0,
    };
  });
}

function getPool(): KeyEntry[] {
  const credentials = getConfiguredCredentials();
  if (!keyPool || keyPool.length !== credentials.length) {
    keyPool = initPool();
  }
  return keyPool;
}

function orderedPoolIndices(pool: KeyEntry[]): number[] {
  const hasOpenRouter = pool.some((entry) => entry.provider === "OpenRouter");
  const now = Date.now();
  return pool
    .map((_, index) => index)
    .sort((a, b) => {
      const healthRank = (entry: KeyEntry) => (entry.cooldownUntil <= now ? 0 : 1);
      const healthDifference = healthRank(pool[a]) - healthRank(pool[b]);
      if (healthDifference) return healthDifference;

      const providerRank = (entry: KeyEntry) =>
        hasOpenRouter && entry.provider === "Groq" ? 1 : 0;
      const rankDifference = providerRank(pool[a]) - providerRank(pool[b]);
      if (rankDifference) return rankDifference;

      const cooldownDifference = pool[a].cooldownUntil - pool[b].cooldownUntil;
      if (cooldownDifference) return cooldownDifference;

      const distanceA = (a - currentKeyIndex + pool.length) % pool.length;
      const distanceB = (b - currentKeyIndex + pool.length) % pool.length;
      return distanceA - distanceB;
    });
}

export const AGENT_MODEL = getConfiguredCredentials()[0]?.model ?? GROQ_DEFAULT_MODEL;

export function isAIConfigured(): boolean {
  return getConfiguredCredentials().length > 0;
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
    throw new Error("No OpenRouter or GROQ_API_KEY configured.");
  }

  const now = Date.now();
  for (const idx of orderedPoolIndices(pool)) {
    const entry = pool[idx];
    if (entry.cooldownUntil <= now) {
      currentKeyIndex = (idx + 1) % pool.length;
      return entry.client;
    }
  }

  // All keys are in cooldown; return the one whose cooldown expires earliest.
  const nextIndex = pool.reduce(
    (bestIndex, entry, index) =>
      entry.cooldownUntil < pool[bestIndex].cooldownUntil ? index : bestIndex,
    0,
  );
  currentKeyIndex = (nextIndex + 1) % pool.length;
  return pool[nextIndex].client;
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
    throw new Error("No OpenRouter or GROQ_API_KEY configured.");
  }

  const now = Date.now();
  const orderedIndices = orderedPoolIndices(pool);

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
        `[lifeos] ${entry.provider} key #${idx + 1} failed (${isRateLimit ? "rate limit" : isQuota ? "quota" : "error"}), trying next key in pool...`,
      );
    }
  }

  throw lastError;
}
export const executeWithDeepSeekPool = executeWithModelPool;
