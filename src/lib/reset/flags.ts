/**
 * Reset Plan & Habit Tracker feature switches.
 *
 * Both sections ship behind flags. The defaults are intentionally on so a
 * fresh checkout can use the section; setting either flag to "false" restores
 * the exact pre-Reset LifeOS behaviour (the sidebar section disappears and
 * every Reset/Habit route returns 404).
 */

function enabled(name: string): boolean {
  return process.env[name] !== "false";
}

export function resetPlanEnabled(): boolean {
  return enabled("RESET_PLAN_ENABLED") && enabled("NEXT_PUBLIC_RESET_PLAN_ENABLED");
}

export function habitTrackerEnabled(): boolean {
  return enabled("HABIT_TRACKER_ENABLED") && enabled("NEXT_PUBLIC_HABIT_TRACKER_ENABLED");
}

export function resetFeatures() {
  return {
    resetPlan: resetPlanEnabled(),
    habitTracker: habitTrackerEnabled(),
  };
}
