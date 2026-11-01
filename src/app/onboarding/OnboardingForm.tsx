"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { completeOnboarding, type OnboardingState } from "./actions";

const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Australia/Sydney",
  "Africa/Nairobi",
  "UTC",
];

export function OnboardingForm({ defaultName, defaultTimezone }: { defaultName: string; defaultTimezone: string }) {
  const [state, formAction, pending] = useActionState<OnboardingState, FormData>(completeOnboarding, {});
  const [timezone, setTimezone] = useState(defaultTimezone);

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected && TIMEZONES.includes(detected)) setTimezone(detected);
  }, []);

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="label">Your name</span>
          <input name="name" defaultValue={defaultName} className="field" placeholder="Shanaya" />
        </label>

        <label className="block space-y-1.5">
          <span className="label">Timezone</span>
          <select
            name="timezone"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            className="field"
          >
            {TIMEZONES.map((zone) => (
              <option key={zone} value={zone} className="bg-[#150f28]">
                {zone}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="label">Wake up</span>
          <input name="wakeTime" type="time" defaultValue="07:00" className="field" />
        </label>

        <label className="block space-y-1.5">
          <span className="label">Wind down</span>
          <input name="sleepTime" type="time" defaultValue="23:00" className="field" />
        </label>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/8 bg-white/[0.03] p-3.5">
        <input type="checkbox" name="prefill" defaultChecked className="mt-0.5 h-4 w-4 accent-violet-500" />
        <span className="text-[0.8rem] leading-relaxed text-white/60">
          <span className="font-semibold text-white/85">Start with an example week.</span> Sleep, meals, study
          blocks, karate and hackathon prep arrive pre-scheduled across your 18 domains — edit or clear anything.
        </span>
      </label>

      {state.error && (
        <p className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary w-full py-2.5">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {pending ? "Building your calendar…" : "Enter LifeOS"}
      </button>
    </form>
  );
}
