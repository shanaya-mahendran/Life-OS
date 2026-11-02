/**
 * Diary Mode feature switch.
 *
 * Defaults to on so the section is usable out of the box; setting
 * DIARY_ENABLED (or the public mirror) to "false" restores the exact
 * pre-Diary LifeOS behaviour — the sidebar entry disappears and every diary
 * route returns 404.
 */

function enabled(name: string): boolean {
  return process.env[name] !== "false";
}

export function diaryEnabled(): boolean {
  return enabled("DIARY_ENABLED") && enabled("NEXT_PUBLIC_DIARY_ENABLED");
}

export function diaryAiEnabled(): boolean {
  return diaryEnabled() && process.env.DIARY_AI_ENABLED !== "false";
}
