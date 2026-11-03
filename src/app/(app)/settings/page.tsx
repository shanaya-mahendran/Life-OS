import { Settings as SettingsIcon, Zap } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { monthTokens } from "@/lib/agent/usage";
import { PageBanner } from "@/components/shell/PageBanner";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { PwaInstallCard } from "@/components/pwa/InstallButton";

export const metadata = { title: "Settings · LifeOS" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { profile, user } = await requireProfile();
  const used = await monthTokens(profile.id, user.timezone);

  const usagePercent =
    profile.monthlyTokenBudget > 0 ? Math.min(100, Math.round((used / profile.monthlyTokenBudget) * 100)) : 0;

  return (
    <div className="space-y-4">
      <PageBanner
        icon={<SettingsIcon className="h-5 w-5" />}
        title="Settings"
        subtitle="Your rhythm, your agent, your data."
      />

      <section className="surface flex flex-wrap items-center gap-3 p-4" aria-label="Monthly usage">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-500/15 text-violet-200">
            <Zap className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-white">Usage this month</span>
              <span className="text-sm tabular-nums text-white/70">
                {(used / 1000).toFixed(1)}K of {(profile.monthlyTokenBudget / 1000).toFixed(0)}K tokens
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Monthly token usage" aria-valuenow={usagePercent} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-violet-300" style={{ width: `${usagePercent}%` }} />
            </div>
          </div>
      </section>

      <SettingsForm
        initial={{
          name: profile.name ?? "",
          email: profile.email,
          timezone: profile.timezone,
          wakeTime: profile.wakeTime,
          sleepTime: profile.sleepTime,
          dayStartHour: profile.dayStartHour,
          dayEndHour: profile.dayEndHour,
          minSleepHours: profile.minSleepHours,
          maxFocusHours: profile.maxFocusHours,
          monthlyTokenBudget: profile.monthlyTokenBudget,
        }}
      />

      <PwaInstallCard />
    </div>
  );
}
