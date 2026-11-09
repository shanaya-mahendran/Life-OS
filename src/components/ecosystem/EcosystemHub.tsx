"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BatteryCharging,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Flame,
  Globe,
  Layers,
  Link2,
  Moon,
  ShieldCheck,
  Sparkles,
  Sunrise,
  Trophy,
  Zap,
} from "lucide-react";
import {
  SEASON_PROFILES,
  type SeasonProfileKey,
  calculateDailyEnergyBudget,
} from "@/lib/domains/ecosystem";
import { withAlpha } from "@/lib/utils";

interface EcosystemHubProps {
  todayLoadMinutes?: number;
  sleepHours?: number;
  moodScore?: number;
}

export function EcosystemHub({
  todayLoadMinutes = 320,
  sleepHours = 7.0,
  moodScore = 4.0,
}: EcosystemHubProps) {
  const [activeSeason, setActiveSeason] = useState<SeasonProfileKey>("normal");
  const [expanded, setExpanded] = useState(false);
  const [shedNotice, setShedNotice] = useState<string | null>(null);

  const profile = SEASON_PROFILES[activeSeason];

  // Calculate energy budget
  const energyBudget = calculateDailyEnergyBudget({
    sleepHours,
    minSleepHours: 7.5,
    recentMoodScore: moodScore,
    todayPlannedBlocks: [
      { minutes: 90, domainSlug: "education", isDemanding: true },
      { minutes: 120, domainSlug: "competitions", isDemanding: true },
      { minutes: 60, domainSlug: "karate", isDemanding: true },
      { minutes: 50, domainSlug: "admin", isDemanding: false },
    ],
  });

  return (
    <div className="surface overflow-hidden rounded-2xl border border-violet-500/20 bg-[linear-gradient(135deg,rgba(30,20,55,0.7),var(--bg-surface)_60%)] p-3.5 sm:p-4">
      {/* Top Banner: Season Profile & Energy Budget Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-white shadow-sm"
            style={{ backgroundColor: withAlpha(profile.accent, 0.3) }}
          >
            <Globe className="h-4 w-4" style={{ color: profile.accent }} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[0.62rem] font-bold uppercase tracking-wider text-violet-300">
                Ecosystem Mode
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-[0.58rem] font-bold uppercase tracking-wider"
                style={{
                  backgroundColor: withAlpha(profile.accent, 0.2),
                  color: profile.accent,
                }}
              >
                {profile.name}
              </span>
            </div>
            <div className="text-[0.76rem] font-semibold text-white/90">
              {profile.description}
            </div>
          </div>
        </div>

        {/* Season Selector Pill & Expand Toggle */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center rounded-xl border border-white/10 bg-white/[0.04] p-0.5 text-[0.68rem]">
            {(Object.keys(SEASON_PROFILES) as SeasonProfileKey[]).map((key) => {
              const item = SEASON_PROFILES[key];
              const isActive = activeSeason === key;
              return (
                <button
                  key={key}
                  onClick={() => {
                    setActiveSeason(key);
                    setShedNotice(null);
                  }}
                  className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                    isActive ? "bg-white/20 text-white shadow-xs" : "text-white/45 hover:text-white/70"
                  }`}
                >
                  {item.badge}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setExpanded(!expanded)}
            className="btn btn-ghost px-2 py-1 text-xs text-white/50 hover:text-white"
            aria-label="Toggle ecosystem breakdown"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Energy Budget Bar Gauge */}
      <div className="mt-3 pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <BatteryCharging className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-semibold text-white/90">Daily Energy Budget:</span>
          <span className="text-xs text-white/60">
            <strong className="text-white">{energyBudget.spentPoints}</strong> of{" "}
            <strong>{energyBudget.capacityPoints} points</strong> capacity spent
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-2 w-36 sm:w-48 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, (energyBudget.spentPoints / energyBudget.capacityPoints) * 100)}%`,
                backgroundColor: energyBudget.isOverBudget
                  ? "#f43f5e"
                  : energyBudget.remainingPoints <= 2
                  ? "#f59e0b"
                  : "#10b981",
              }}
            />
          </div>

          {energyBudget.isOverBudget && (
            <button
              onClick={() =>
                setShedNotice("Protected: Lowest priority study block (60m) deferred to tomorrow to preserve sleep minimum.")
              }
              className="rounded-lg bg-rose-500/20 px-2 py-0.5 text-[0.65rem] font-bold text-rose-300 hover:bg-rose-500/30 transition border border-rose-500/30"
            >
              Shed Low Priority
            </button>
          )}
        </div>
      </div>

      {shedNotice && (
        <div className="mt-2 flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-2 text-xs text-emerald-300">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          <span>{shedNotice}</span>
        </div>
      )}

      {/* Expanded Rule Overrides & Cross-Domain Flow Inspector */}
      {expanded && (
        <div className="mt-3.5 pt-3 border-t border-white/10 space-y-3">
          <div className="flex items-center justify-between text-xs text-white/50">
            <span className="font-semibold text-white/80">Active Season Overrides ({profile.overrides.length}):</span>
            <span className="text-[0.65rem]">Protected Tiers: Tier 1 (Medicine, Prayer, Sleep) locked</span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {profile.overrides.length === 0 ? (
              <div className="col-span-full rounded-xl bg-white/[0.02] p-2.5 text-xs text-white/40 italic">
                Standard balanced defaults active across all 22 domains.
              </div>
            ) : (
              profile.overrides.map((override, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5 text-xs flex items-start gap-2"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-violet-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-white/90 capitalize">{override.domainSlug}</div>
                    <div className="text-[0.68rem] text-white/50 leading-snug mt-0.5">{override.ruleChange}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
