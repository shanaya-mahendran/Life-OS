/**
 * DeepSeek adapter.
 *
 * Server-only: the API key must never reach the browser. Keeping the client in
 * one thin module means a model or provider change touches nothing else.
 */

import OpenAI from "openai";

export const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
export const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";

let cached: OpenAI | null = null;

export function isDeepSeekConfigured(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

export function getDeepSeek(): OpenAI {
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error("DEEPSEEK_API_KEY is not configured.");
  }
  if (!cached) {
    cached = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: DEEPSEEK_BASE_URL,
      timeout: 45_000,
      maxRetries: 1,
    });
  }
  return cached;
}

export const AGENT_MODEL = DEEPSEEK_MODEL;
