import { Settings as SettingsIcon, Zap } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireProfile } from "@/lib/auth";
import { monthTokens } from "@/lib/agent/usage";
import { AGENT_MODEL, isDeepSeekConfigured } from "@/lib/agent/llm";
import { PageBanner } from "@/components/shell/PageBanner";
import { SettingsForm } from "@/components/settings/SettingsForm";

export const metadata = { title: "Settings · LifeOS" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { profile, user } = await requireProfile();
  const [used, logCount, eventCount] = await Promise.all([
    monthTokens(profile.id, user.timezone),
    prisma.agentLog.count({ where: { userId: profile.id } }),
    prisma.event.count({ where: { userId: profile.id } }),
  ]);

  const usagePercent =
    profile.monthlyTokenBudget > 0 ? Math.min(100, Math.round((used / profile.monthlyTokenBudget) * 100)) : 0;

  return (
    <div className="space-y-4">
      <PageBanner
        icon={<SettingsIcon className="h-5 w-5" />}
        title="Settings"
        subtitle="Your rhythm, your agent, your data."
        aside={
          <div className="hidden rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right sm:block">
            <p className="text-[0.66rem] text-white/45">
              {isDeepSeekConfigured() ? AGENT_MODEL : "rules engine"}
            </p>
            <p className="mt-0.5 text-[0.58rem] uppercase tracking-[0.16em] text-white/25">agent engine</p>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="surface flex items-center gap-3 p-3.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-500/15 text-violet-200">
            <Zap className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="font-display text-[0.95rem] font-semibold text-white">
              {(used / 1000).toFixed(1)}K / {(profile.monthlyTokenBudget / 1000).toFixed(0)}K
            </div>
            <div className="text-[0.58rem] uppercase tracking-[0.14em] text-white/30">tokens this month</div>
          </div>
          <div className="ml-auto h-10 w-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="w-full rounded-full bg-gradient-to-b from-violet-300 to-fuchsia-400"
              style={{ height: `${Math.max(3, usagePercent)}%`, marginTop: `${100 - Math.max(3, usagePercent)}%` }}
            />
          </div>
        </div>

        <div className="surface p-3.5">
          <div className="font-display text-[0.95rem] font-semibold text-white">{logCount}</div>
          <div className="text-[0.58rem] uppercase tracking-[0.14em] text-white/30">agent turns logged</div>
        </div>

        <div className="surface p-3.5">
          <div className="font-display text-[0.95rem] font-semibold text-white">{eventCount}</div>
          <div className="text-[0.58rem] uppercase tracking-[0.14em] text-white/30">events on the calendar</div>
        </div>
      </div>

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
    </div>
  );
}
