"use client";

import { useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  FileText,
  Flame,
  Heart,
  Layers,
  Sparkles,
  Sunrise,
  Trophy,
  Users,
  Utensils,
  Zap,
} from "lucide-react";
import { withAlpha } from "@/lib/utils";
import { getDomain, type DomainSlug } from "@/lib/domains/catalog";

interface SignatureWidgetProps {
  slug: string;
  accent: string;
  timeZone: string;
}

export function SignatureWidget({ slug, accent, timeZone }: SignatureWidgetProps) {
  const config = getDomain(slug);
  const [activeTab, setActiveTab] = useState<number>(0);

  // 1. Prayer: Sun-arc and 5-shade year heatmap
  if (slug === "prayer") {
    const prayers = [
      { name: "Fajr", time: "05:15 AM", status: "done" },
      { name: "Sunrise", time: "06:30 AM", status: "info" },
      { name: "Dhuhr", time: "12:30 PM", status: "done" },
      { name: "Asr", time: "03:45 PM", status: "done" },
      { name: "Maghrib", time: "06:05 PM", status: "upcoming" },
      { name: "Isha", time: "07:30 PM", status: "upcoming" },
    ];
    // Generate 52 weeks of mock heatmap data (0-5 shade level)
    const shades = [0, 1, 3, 4, 4, 3, 4, 4, 4, 2, 4, 4, 3, 4];

    return (
      <div className="surface rounded-2xl border border-white/10 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sunrise className="h-4 w-4" style={{ color: accent }} />
            <h3 className="text-sm font-semibold text-white/90">Moving Sun Anchors & Year Heatmap</h3>
          </div>
          <span className="text-[0.68rem] text-white/40">Tier 1 Fixed Anchors</span>
        </div>

        {/* 5 Prayers Arc Strip */}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {prayers.map((p) => (
            <div
              key={p.name}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-center transition hover:bg-white/[0.06]"
              style={{
                borderColor: p.status === "done" ? withAlpha(accent, 0.4) : "rgba(255,255,255,0.08)",
              }}
            >
              <div className="text-[0.72rem] font-medium text-white/80">{p.name}</div>
              <div className="mt-0.5 text-[0.68rem] tabular-nums text-white/50">{p.time}</div>
              <div className="mt-1.5 flex justify-center">
                {p.status === "done" ? (
                  <span className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[0.55rem] font-semibold text-emerald-300 bg-emerald-500/10">
                    <CheckCircle2 className="h-2.5 w-2.5" /> Done
                  </span>
                ) : p.status === "upcoming" ? (
                  <span className="rounded-full px-1.5 py-0.5 text-[0.55rem] font-medium text-white/40 bg-white/5">
                    Anchor
                  </span>
                ) : (
                  <span className="rounded-full px-1.5 py-0.5 text-[0.55rem] font-medium text-amber-300/80 bg-amber-500/10">
                    Sun
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Year Contribution Grid (GitHub style, orchid tint) */}
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[0.7rem] text-white/45">
            <span>Year Consistency (5 daily prayers)</span>
            <div className="flex items-center gap-1 text-[0.62rem]">
              <span>Less</span>
              {[0, 1, 2, 3, 4].map((lvl) => (
                <span
                  key={lvl}
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{
                    backgroundColor:
                      lvl === 0
                        ? "rgba(255,255,255,0.06)"
                        : withAlpha(accent, 0.2 + lvl * 0.2),
                  }}
                />
              ))}
              <span>More</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: 42 }).map((_, i) => {
              const shade = shades[i % shades.length];
              return (
                <div
                  key={i}
                  title={`Day ${i + 1}: ${shade} prayers`}
                  className="h-3 w-3 rounded-sm transition hover:scale-125"
                  style={{
                    backgroundColor:
                      shade === 0
                        ? "rgba(255,255,255,0.06)"
                        : withAlpha(accent, 0.2 + shade * 0.2),
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // 2. Sleep: 24h dial and debt bank
  if (slug === "sleep") {
    return (
      <div className="surface rounded-2xl border border-white/10 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white/90">Sleep Debt Bank</h3>
          <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[0.62rem] font-semibold text-indigo-300">
            7.5h Target
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3 text-center">
            <div className="text-[0.65rem] uppercase tracking-wider text-white/40">7-Day Debt</div>
            <div className="mt-1 font-display text-2xl font-bold text-indigo-300">1.5h</div>
            <p className="mt-1 text-[0.68rem] text-white/50">Repay by sleeping 25m earlier for 3 nights.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3 text-center">
            <div className="text-[0.65rem] uppercase tracking-wider text-white/40">Sleep Window</div>
            <div className="mt-1 font-display text-2xl font-bold text-white">11:00 PM – 07:00 AM</div>
            <p className="mt-1 text-[0.68rem] text-white/50">Protected Tier 1 Anchor: never overlapped without confirmation.</p>
          </div>
        </div>
      </div>
    );
  }

  // 3. Medicine: Dose-Safe Timeline
  if (slug === "medicine") {
    return (
      <div className="surface rounded-2xl border border-white/10 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white/90">Dose-Safe Timeline</h3>
          <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-[0.62rem] font-semibold text-teal-300">
            Tier 1 Anchor
          </span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-xl border border-teal-500/20 bg-teal-500/5 p-2.5">
            <div>
              <div className="text-xs font-semibold text-white">Morning Dose (Inhaler)</div>
              <div className="text-[0.68rem] text-white/45">08:00 AM · 1 puff · Stock: 14 days left</div>
            </div>
            <span className="flex items-center gap-1 text-[0.65rem] font-medium text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" /> Taken
            </span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-2.5">
            <div>
              <div className="text-xs font-semibold text-white">Evening Vitamin D & Calcium</div>
              <div className="text-[0.68rem] text-white/45">08:30 PM · 1 tablet · Stock: 28 days left</div>
            </div>
            <span className="text-[0.65rem] font-medium text-white/40">Upcoming Anchor</span>
          </div>
        </div>
      </div>
    );
  }

  // 4. Competitions: Reverse Sprint Bar
  if (slug === "competitions") {
    return (
      <div className="surface rounded-2xl border border-white/10 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white/90">Reverse Sprint Milestones</h3>
          <Trophy className="h-4 w-4" style={{ color: accent }} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2 text-center">
            <span className="text-[0.6rem] uppercase tracking-wider text-white/40">T-36h</span>
            <div className="text-xs font-semibold text-white">Build Freeze</div>
            <div className="text-[0.62rem] text-white/40">Code Stop</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2 text-center">
            <span className="text-[0.6rem] uppercase tracking-wider text-white/40">T-18h</span>
            <div className="text-xs font-semibold text-white">Demo Recording</div>
            <div className="text-[0.62rem] text-white/40">Video & Deck</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2 text-center">
            <span className="text-[0.6rem] uppercase tracking-wider text-white/40">T-6h</span>
            <div className="text-xs font-semibold text-white">Pitch Rehearsals</div>
            <div className="text-[0.62rem] text-white/40">Rubric Scoring</div>
          </div>
          <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-2 text-center">
            <span className="text-[0.6rem] uppercase tracking-wider text-amber-300">T-2h</span>
            <div className="text-xs font-semibold text-amber-200">2h Safety Buffer</div>
            <div className="text-[0.62rem] text-amber-300/60">Submission Guard</div>
          </div>
        </div>
      </div>
    );
  }

  // 5. Education: Mastery Map
  if (slug === "education") {
    const topics = [
      { name: "Dynamic Programming", confidence: 45, weight: 30 },
      { name: "Graph Algorithms", confidence: 78, weight: 25 },
      { name: "Tree Traversals", confidence: 92, weight: 20 },
      { name: "System Design Patterns", confidence: 60, weight: 25 },
    ];
    return (
      <div className="surface rounded-2xl border border-white/10 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white/90">Mastery Heatmap & Spaced Revision</h3>
          <span className="text-[0.65rem] text-white/40">Confidence 0–100%</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {topics.map((t) => (
            <div key={t.name} className="rounded-xl border border-white/10 bg-white/[0.025] p-2.5">
              <div className="flex items-center justify-between text-xs font-medium text-white/80">
                <span>{t.name}</span>
                <span className="tabular-nums text-white/50">{t.confidence}%</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${t.confidence}%`,
                    backgroundColor: t.confidence < 60 ? "#f87171" : t.confidence < 80 ? "#fbbf24" : "#34d399",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 6. Karate: Belt Path Ladder
  if (slug === "karate") {
    return (
      <div className="surface rounded-2xl border border-white/10 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white/90">Belt Path Grading Ladder</h3>
          <span className="text-[0.65rem] text-rose-300">Brown Belt · 8 Weeks Out</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
            <div className="text-[0.65rem] text-white/40">Week 1–4 Focus</div>
            <div className="mt-0.5 text-xs font-semibold text-white">Bassai Dai & Kanku Dai</div>
            <div className="text-[0.65rem] text-emerald-400">Drills scheduled</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
            <div className="text-[0.65rem] text-white/40">Week 5–7 Focus</div>
            <div className="mt-0.5 text-xs font-semibold text-white">Kumite Combinations</div>
            <div className="text-[0.65rem] text-white/40">Taper before test</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
            <div className="text-[0.65rem] text-white/40">Final Week</div>
            <div className="mt-0.5 text-xs font-semibold text-white">Full Syllabus Review</div>
            <div className="text-[0.65rem] text-amber-300">Light sessions only</div>
          </div>
        </div>
      </div>
    );
  }

  // 7. Mood Reflections: Two-axis tap grid & weather map
  if (slug === "mood") {
    return (
      <div className="surface rounded-2xl border border-white/10 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white/90">Private Weather Map</h3>
          <span className="text-[0.65rem] text-pink-300">Private by default</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3 text-center">
            <div className="text-[0.65rem] uppercase tracking-wider text-white/40">7-Day Mood Trend</div>
            <div className="mt-1 font-display text-xl font-bold text-pink-300">4.2 / 5.0</div>
            <p className="mt-0.5 text-[0.68rem] text-white/50">Higher energy correlates with 7.5h+ sleep.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3 text-center">
            <div className="text-[0.65rem] uppercase tracking-wider text-white/40">Gentle Mode</div>
            <div className="mt-1 text-xs font-medium text-white">Off</div>
            <p className="mt-0.5 text-[0.68rem] text-white/50">Proposes lighter next-day load when energy dips.</p>
          </div>
        </div>
      </div>
    );
  }

  // 8. Forward Planning: Life Compass Balance Wheel
  if (slug === "planning") {
    return (
      <div className="surface rounded-2xl border border-white/10 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white/90">Life Compass: Stated Intent vs Actuals</h3>
          <Compass className="h-4 w-4 text-violet-300" />
        </div>
        <p className="text-[0.72rem] text-white/50 leading-relaxed">
          The balance wheel compares intended weekly hours with actual calendar logs, proposing rebalancing for the upcoming week.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2 text-center">
            <div className="text-[0.62rem] text-white/40">Education</div>
            <div className="text-xs font-semibold text-white">14h / 15h</div>
            <div className="text-[0.6rem] text-emerald-400">On target</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2 text-center">
            <div className="text-[0.62rem] text-white/40">Open Source</div>
            <div className="text-xs font-semibold text-white">2h / 4h</div>
            <div className="text-[0.6rem] text-amber-400">2h deficit</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2 text-center">
            <div className="text-[0.62rem] text-white/40">Karate</div>
            <div className="text-xs font-semibold text-white">4.5h / 4.5h</div>
            <div className="text-[0.6rem] text-emerald-400">100% adherence</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2 text-center">
            <div className="text-[0.62rem] text-white/40">Rest & Buffer</div>
            <div className="text-xs font-semibold text-white">6h / 7h</div>
            <div className="text-[0.6rem] text-emerald-400">Protected</div>
          </div>
        </div>
      </div>
    );
  }

  // Default Fallback Unique System Header Card
  return (
    <div
      className="surface rounded-2xl border p-4"
      style={{ borderColor: withAlpha(accent, 0.25), backgroundColor: withAlpha(accent, 0.04) }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/90">
          {config?.uniqueSystem?.name ?? "Domain Knowledge System"}
        </h3>
        <span
          className="rounded-full px-2 py-0.5 text-[0.62rem] font-semibold"
          style={{ backgroundColor: withAlpha(accent, 0.2), color: accent }}
        >
          {config?.uniqueSystem?.tagline ?? "Knowledge System"}
        </span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-white/60">
        {config?.uniqueSystem?.description ?? config?.tagline}
      </p>
    </div>
  );
}
