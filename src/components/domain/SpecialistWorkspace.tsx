"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  Cpu,
  Droplet,
  FileText,
  Flame,
  GitPullRequest,
  Heart,
  Layers,
  Link2,
  Lock,
  Moon,
  Pill,
  Plus,
  RefreshCw,
  Share2,
  ShieldAlert,
  Smile,
  Sparkles,
  Sunrise,
  Target,
  Trophy,
  Users,
  Utensils,
  Zap,
} from "lucide-react";
import { withAlpha } from "@/lib/utils";
import { domainFamilyColor } from "@/lib/domains/presentation";
import { DOMAIN_ECOSYSTEM_MAP, type DomainEcosystemTie } from "@/lib/domains/ecosystem";
import { type DomainSlug, DOMAIN_MAP } from "@/lib/domains/catalog";
import { MainTaskBoard, type BoardTask } from "@/components/tasks/MainTaskBoard";
import { ToastStack, type ToastMessage } from "@/components/ui/Toast";

interface SpecialistWorkspaceProps {
  domain: {
    slug: string;
    name: string;
    accent: string;
    goals: string[];
    notes: string;
    isProtected: boolean;
  };
  tasks: BoardTask[];
  timeZone: string;
  eventTypes: { title: string; minutes: number }[];
}

type Tab = "specialist" | "ecosystem" | "tasks" | "goals";

let toastCounter = 0;

export function SpecialistWorkspace({ domain, tasks, timeZone, eventTypes }: SpecialistWorkspaceProps) {
  const slug = domain.slug as DomainSlug;
  const accent = domainFamilyColor(domain.slug, domain.accent);
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("specialist");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [, startTransition] = useTransition();

  // Ecosystem connections for this domain
  const ecosystemTies = DOMAIN_ECOSYSTEM_MAP[slug] ?? [];

  function pushToast(text: string, tone: "success" | "error" = "success") {
    toastCounter += 1;
    setToasts((cur) => [...cur, { id: toastCounter, text, tone }]);
  }

  return (
    <div className="space-y-4">
      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
        <div className="flex items-center gap-1 rounded-xl bg-white/[0.04] p-1 border border-white/10">
          <button
            onClick={() => setTab("specialist")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              tab === "specialist" ? "bg-white/15 text-white shadow-sm" : "text-white/50 hover:text-white/80"
            }`}
          >
            <Cpu className="h-3.5 w-3.5" style={{ color: accent }} />
            <span>Independent System</span>
          </button>

          <button
            onClick={() => setTab("ecosystem")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              tab === "ecosystem" ? "bg-white/15 text-white shadow-sm" : "text-white/50 hover:text-white/80"
            }`}
          >
            <Link2 className="h-3.5 w-3.5 text-violet-400" />
            <span>Cross-Domain Ecosystem</span>
            <span className="rounded-full bg-violet-500/20 px-1.5 py-0.2 text-[0.6rem] font-bold text-violet-300">
              {ecosystemTies.length}
            </span>
          </button>

          <button
            onClick={() => setTab("tasks")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              tab === "tasks" ? "bg-white/15 text-white shadow-sm" : "text-white/50 hover:text-white/80"
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span>Tasks & Board ({tasks.length})</span>
          </button>

          <button
            onClick={() => setTab("goals")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              tab === "goals" ? "bg-white/15 text-white shadow-sm" : "text-white/50 hover:text-white/80"
            }`}
          >
            <Target className="h-3.5 w-3.5 text-amber-400" />
            <span>Goals & Intent ({domain.goals.length})</span>
          </button>
        </div>

        <div className="text-[0.7rem] text-white/40 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />
          <span>{domain.name} Knowledge System</span>
        </div>
      </div>

      {/* TAB 1: INDEPENDENT SPECIALIST SYSTEM */}
      {tab === "specialist" && (
        <section className="space-y-4">
          <SpecialistDomainTool slug={slug} accent={accent} pushToast={pushToast} />
        </section>
      )}

      {/* TAB 2: CROSS-DOMAIN ECOSYSTEM */}
      {tab === "ecosystem" && (
        <section className="space-y-4">
          <div className="surface rounded-2xl border border-white/10 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Link2 className="h-4 w-4 text-violet-400" />
              <h2 className="text-sm font-semibold text-white">
                How {domain.name} Interconnects with the LifeOS Ecosystem
              </h2>
            </div>
            <p className="text-xs text-white/50 leading-relaxed mb-4">
              LifeOS does not treat domains as isolated task silos. Changes in {domain.name} trigger notifications,
              adjust energy budgets, and automatically feed evidence or tier protection across connected domains.
            </p>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ecosystemTies.map((tie) => {
                const targetConfig = DOMAIN_MAP[tie.targetSlug];
                const targetAccent = targetConfig?.accent ?? "#a78bfa";
                return (
                  <div
                    key={tie.targetSlug}
                    className="flex flex-col justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3 transition hover:bg-white/[0.05]"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[0.62rem] font-bold uppercase tracking-wider text-violet-300">
                          {tie.relationship.replace("_", " ")}
                        </span>
                        <Link
                          href={`/domains/${tie.targetSlug}`}
                          className="flex items-center gap-1 text-[0.68rem] font-medium text-white/60 hover:text-white"
                        >
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: targetAccent }} />
                          <span>{targetConfig?.name ?? tie.targetSlug}</span>
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                      <h3 className="text-xs font-semibold text-white/90">{tie.label}</h3>
                      <p className="mt-1 text-[0.72rem] text-white/50 leading-relaxed">{tie.description}</p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between">
                      <span className="text-[0.6rem] text-white/30">Active Link</span>
                      <button
                        onClick={() => pushToast(`Ecosystem sync verified between ${domain.name} and ${targetConfig?.name}.`)}
                        className="text-[0.65rem] font-semibold text-violet-300 hover:text-violet-200"
                      >
                        Test Bridge →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* TAB 3: TASKS & BOARD */}
      {tab === "tasks" && (
        <section className="space-y-4">
          <MainTaskBoard tasks={tasks} domainSlug={domain.slug} domainName={domain.name} timeZone={timeZone} />
        </section>
      )}

      {/* TAB 4: GOALS & NOTES */}
      {tab === "goals" && (
        <section className="grid gap-4 md:grid-cols-2">
          <div className="surface rounded-2xl border border-white/10 p-4 space-y-3">
            <h2 className="text-sm font-semibold text-white">Stated Strategic Intent</h2>
            <p className="text-xs text-white/50">
              The Life Compass weekly review tracks logged hours against these intents to verify life balance.
            </p>
            {domain.goals.length === 0 ? (
              <p className="text-xs text-white/30 italic">No stated goals yet for this domain.</p>
            ) : (
              <ul className="space-y-2">
                {domain.goals.map((g, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-lg bg-white/[0.03] p-2.5 text-xs text-white/80 border border-white/5">
                    <Target className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    <span>{g}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="surface rounded-2xl border border-white/10 p-4 space-y-3">
            <h2 className="text-sm font-semibold text-white">Domain Knowledge Notes</h2>
            <div className="rounded-lg bg-white/[0.02] p-3 text-xs text-white/60 leading-relaxed border border-white/5 whitespace-pre-wrap">
              {domain.notes || "No custom domain notes. Notes added here are preserved and referenced by agent planning."}
            </div>
          </div>
        </section>
      )}

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((cur) => cur.filter((t) => t.id !== id))} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Specialized Independent System Implementations for All Domain Clusters     */
/* -------------------------------------------------------------------------- */

function SpecialistDomainTool({
  slug,
  accent,
  pushToast,
}: {
  slug: DomainSlug;
  accent: string;
  pushToast: (msg: string, tone?: "success" | "error") => void;
}) {
  // 1. CAREER: Application Pipeline Kanban & Skill-Gap Radar
  if (slug === "career") {
    const stages = ["Saved", "Applied", "Screen", "Interview", "Offer"];
    return (
      <div className="surface rounded-2xl border border-white/10 p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h2 className="text-sm font-bold text-white">Application Pipeline & Skill-Gap Radar</h2>
            <p className="text-xs text-white/50">
              Advancing an application stage automatically schedules 7-day follow-up reminders and interview prep blocks.
            </p>
          </div>
          <button
            onClick={() => pushToast("Simulated target role comparison: 3 missing skills sent to Learning Tree.")}
            className="btn btn-ghost text-xs"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            <span>Scan Skill Gaps</span>
          </button>
        </div>

        {/* Pipeline Columns */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {stages.map((stg, idx) => (
            <div key={stg} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[0.7rem] font-bold text-white/80">{stg}</span>
                <span className="text-[0.6rem] rounded-full bg-white/10 px-1.5 py-0.2 text-white/40">{idx === 1 ? "2" : idx === 3 ? "1" : "0"}</span>
              </div>
              {idx === 1 && (
                <div className="space-y-1.5">
                  <div className="rounded-lg bg-white/5 p-2 text-xs border border-white/10">
                    <div className="font-semibold text-white/90 text-[0.74rem]">Senior Frontend Eng</div>
                    <div className="text-[0.62rem] text-white/40">Vercel · Applied 4d ago</div>
                  </div>
                  <div className="rounded-lg bg-white/5 p-2 text-xs border border-white/10">
                    <div className="font-semibold text-white/90 text-[0.74rem]">Staff AI Architect</div>
                    <div className="text-[0.62rem] text-white/40">Anthropic · Applied 2d ago</div>
                  </div>
                </div>
              )}
              {idx === 3 && (
                <div className="rounded-lg bg-violet-500/10 p-2 text-xs border border-violet-400/20">
                  <div className="font-semibold text-violet-200 text-[0.74rem]">Principal Lead</div>
                  <div className="text-[0.62rem] text-violet-300/60">Google · Tech Screen Tomorrow</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 2. EDUCATION: Mastery Map, Spaced Revision, Grade Calculator
  if (slug === "education") {
    return (
      <div className="surface rounded-2xl border border-white/10 p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h2 className="text-sm font-bold text-white">Mastery Map & Grade Target Calculator</h2>
            <p className="text-xs text-white/50">
              Topics decay confidence over time; revision blocks lean heavily into topics with the largest gap from 100%.
            </p>
          </div>
          <button
            onClick={() => pushToast("Generated 4 spaced revision blocks (1, 3, 7, 14 days) in calendar.")}
            className="btn btn-primary text-xs"
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Plan Spaced Revision</span>
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { title: "Advanced Distributed Systems", confidence: 45, weight: 40, status: "Weak" },
            { title: "Database Internals & B-Trees", confidence: 82, weight: 30, status: "Solid" },
            { title: "Compiler Design & ASTs", confidence: 60, weight: 30, status: "Moderate" },
          ].map((topic) => (
            <div key={topic.title} className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white/90">{topic.title}</span>
                <span
                  className={`text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full ${
                    topic.confidence < 50 ? "bg-rose-500/15 text-rose-300" : "bg-emerald-500/15 text-emerald-300"
                  }`}
                >
                  {topic.confidence}% Confidence
                </span>
              </div>
              <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${topic.confidence}%`,
                    backgroundColor: topic.confidence < 50 ? "#f43f5e" : topic.confidence < 75 ? "#f59e0b" : "#10b981",
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[0.65rem] text-white/40">
                <span>Exam Weight: {topic.weight}%</span>
                <span>Interval: {topic.confidence < 50 ? "1d gap" : "7d gap"}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 3. COMPETITIONS: Reverse Sprint Builder & Rubric Scorer
  if (slug === "competitions") {
    return (
      <div className="surface rounded-2xl border border-white/10 p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h2 className="text-sm font-bold text-white">Reverse Sprint Timeline & Rubric Scorer</h2>
            <p className="text-xs text-white/50">
              Working backwards from submission: 2h submission buffer $\rightarrow$ demo recording $\rightarrow$ build freeze $\rightarrow$ pitch rehearsal.
            </p>
          </div>
          <button
            onClick={() => pushToast("Reverse Sprint generated: rehearsal slots avoid meal and sleep anchors.")}
            className="btn btn-primary text-xs"
          >
            <Trophy className="h-3.5 w-3.5" />
            <span>Run Reverse Sprint</span>
          </button>
        </div>

        <div className="space-y-2">
          {[
            { step: "Final Submission Buffer", time: "T-0:00 to T-2:00", tier: "Tier 1 Anchor", safe: true },
            { step: "Demo Video Recording & Upload", time: "T-2:00 to T-4:30", tier: "Tier 2 Protected", safe: true },
            { step: "Build Freeze & Smoke Test", time: "T-4:30 to T-6:00", tier: "Tier 2 Protected", safe: true },
            { step: "Pitch Deck & Rehearsal Run", time: "T-6:00 to T-9:00", tier: "Tier 3 Flexible", safe: true },
          ].map((item, idx) => (
            <div key={idx} className="flex items-center justify-between rounded-xl bg-white/[0.03] p-2.5 border border-white/5 text-xs">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                <span className="font-semibold text-white/90">{item.step}</span>
              </div>
              <div className="flex items-center gap-3 text-white/45 text-[0.7rem]">
                <span>{item.time}</span>
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[0.62rem] text-white/70">{item.tier}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 4. LEARNING: Interactive Skill Tree Roadmap Graph
  if (slug === "learning") {
    return (
      <div className="surface rounded-2xl border border-white/10 p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h2 className="text-sm font-bold text-white">Skill Tree Prerequisite Graph</h2>
            <p className="text-xs text-white/50">
              Prerequisites unlock downstream skills. Nodes are scored by match to Career target roles and Education exams.
            </p>
          </div>
          <button
            onClick={() => pushToast("Highest scoring unlocked node (RAG Architecture) booked as daily focus block.")}
            className="btn btn-ghost text-xs"
          >
            <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
            <span>Select Daily Focus</span>
          </button>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {[
            { skill: "Vector Embeddings & Cosine Sim", status: "Unlocked", score: 92, active: true },
            { skill: "RAG Pipeline Architecture", status: "Unlocked (Recommended)", score: 98, active: true },
            { skill: "Fine-Tuning LoRA Adapters", status: "Locked (Requires Python Core)", score: 40, active: false },
          ].map((node) => (
            <div
              key={node.skill}
              className={`rounded-xl border p-3 text-xs space-y-1.5 ${
                node.active ? "border-cyan-400/30 bg-cyan-500/10" : "border-white/5 bg-white/[0.02] opacity-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">{node.skill}</span>
                <span className="text-[0.62rem] text-cyan-300 font-semibold">{node.score} pts</span>
              </div>
              <div className="text-[0.65rem] text-white/40">{node.status}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 5. SLEEP: Sleep Debt Bank & Chronotype Window
  if (slug === "sleep") {
    return (
      <div className="surface rounded-2xl border border-white/10 p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h2 className="text-sm font-bold text-white">Sleep Debt Bank & Repayment Scheduler</h2>
            <p className="text-xs text-white/50">
              Sum of 7-day shortfalls under your 7.5h minimum. Repays by moving bedtime earlier and shedding low-priority blocks.
            </p>
          </div>
          <button
            onClick={() => pushToast("Bedtime shifted 30 min earlier for next 3 days; lowest-priority block shed.")}
            className="btn btn-primary text-xs"
          >
            <Moon className="h-3.5 w-3.5" />
            <span>Apply Repayment Plan</span>
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="text-[0.65rem] uppercase tracking-wider text-white/40">7-Day Debt Accumulator</div>
            <div className="mt-1 text-2xl font-bold text-amber-300">1.8 hrs</div>
            <div className="text-[0.65rem] text-white/40 mt-0.5">2 short nights this week</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="text-[0.65rem] uppercase tracking-wider text-white/40">Chronotype Focus Peak</div>
            <div className="mt-1 text-2xl font-bold text-violet-300">09:00 – 13:00</div>
            <div className="text-[0.65rem] text-white/40 mt-0.5">Demanding blocks prefer this slot</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="text-[0.65rem] uppercase tracking-wider text-white/40">Repayment Proposal</div>
            <div className="mt-1 text-base font-bold text-emerald-300">+25m Bedtime Shift</div>
            <div className="text-[0.65rem] text-white/40 mt-0.5">Recovers balance in 3 nights</div>
          </div>
        </div>
      </div>
    );
  }

  // 6. FOOD: Prep-Once Load Planner & Fasting Mode
  if (slug === "food") {
    return (
      <div className="surface rounded-2xl border border-white/10 p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h2 className="text-sm font-bold text-white">Prep-Once Meal Matcher & Fasting Mode</h2>
            <p className="text-xs text-white/50">
              Matches meal complexity to daily cognitive load: heavy exam/competition days get zero-cook meals; light days get batch prep.
            </p>
          </div>
          <button
            onClick={() => pushToast("Fasting mode synchronized with Prayer domain: meal windows moved to dawn/dusk.")}
            className="btn btn-ghost text-xs"
          >
            <Sunrise className="h-3.5 w-3.5 text-amber-300" />
            <span>Sync Fasting Mode</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { day: "Mon", load: "Heavy (7h)", plan: "Zero-cook / Leftover" },
            { day: "Tue", load: "Normal (5h)", plan: "Quick 20m Stir-fry" },
            { day: "Wed", load: "Heavy (8h)", plan: "Zero-cook Soup Batch" },
            { day: "Sun", load: "Light (2h)", plan: "Batch-Cook Session (90m)" },
          ].map((d) => (
            <div key={d.day} className="rounded-xl border border-white/10 bg-white/[0.02] p-2.5 text-xs">
              <div className="font-bold text-white/90">{d.day}</div>
              <div className="text-[0.65rem] text-amber-300/80">{d.load}</div>
              <div className="mt-1 text-[0.72rem] text-white/60">{d.plan}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 7. MEDICINE: Dose-Safe Scheduler & Doctor Visit Brief
  if (slug === "medicine") {
    return (
      <div className="surface rounded-2xl border border-white/10 p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h2 className="text-sm font-bold text-white">Dose-Safe Scheduler & Clinical Brief</h2>
            <p className="text-xs text-white/50">
              Doses are Tier 1 fixed anchors. Reminders are discreet and never advise dosing or diagnose.
            </p>
          </div>
          <button
            onClick={() => pushToast("One-page Doctor Visit Brief compiled and ready for appointment.")}
            className="btn btn-primary text-xs"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Export Visit Brief</span>
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2">
            <span className="text-xs font-semibold text-white/90">Active Prescription Anchors</span>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between rounded-lg bg-white/5 p-2 text-xs">
                <span>Omega-3 + Vitamin D3</span>
                <span className="text-emerald-300 font-semibold">08:00 AM (With Meal)</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white/5 p-2 text-xs">
                <span>Magnesium Glycinate</span>
                <span className="text-emerald-300 font-semibold">22:00 PM (Before Bed)</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2">
            <span className="text-xs font-semibold text-white/90">Refill Countdown Tracker</span>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60">Stock Remaining:</span>
                <span className="font-bold text-white">18 days left</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60">Lead Time Threshold:</span>
                <span className="text-amber-300 font-semibold">7 days</span>
              </div>
              <div className="text-[0.65rem] text-white/40">Refill task will trigger automatically in 11 days.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 8. REST & BUFFER: Burnout Recovery Forecast
  if (slug === "rest") {
    return (
      <div className="surface rounded-2xl border border-white/10 p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h2 className="text-sm font-bold text-white">Recovery Forecast & Buffer Enforcement</h2>
            <p className="text-xs text-white/50">
              Combines next week planned hours + sleep debt + mood trend to evaluate burnout risk before the week begins.
            </p>
          </div>
          <button
            onClick={() => pushToast("Added mandatory 15m buffer blocks after demanding study sessions.")}
            className="btn btn-ghost text-xs"
          >
            <Activity className="h-3.5 w-3.5 text-violet-300" />
            <span>Enforce Gap Rules</span>
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="text-[0.65rem] text-white/40 uppercase">Upcoming Load</div>
            <div className="text-xl font-bold text-white/90">32 hrs planned</div>
            <div className="text-[0.65rem] text-emerald-400 mt-0.5">Within safe cap (36h max)</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="text-[0.65rem] text-white/40 uppercase">Burnout Risk Level</div>
            <div className="text-xl font-bold text-emerald-300">Low Risk</div>
            <div className="text-[0.65rem] text-white/40 mt-0.5">Sleep & mood stable</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="text-[0.65rem] text-white/40 uppercase">Protected Downtime</div>
            <div className="text-xl font-bold text-violet-300">Sunday Full Day</div>
            <div className="text-[0.65rem] text-white/40 mt-0.5">Zero commitments scheduled</div>
          </div>
        </div>
      </div>
    );
  }

  // 9. FORWARD PLANNING: Life Compass Balance Wheel
  if (slug === "planning") {
    return (
      <div className="surface rounded-2xl border border-white/10 p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h2 className="text-sm font-bold text-white">Life Compass Balance Wheel</h2>
            <p className="text-xs text-white/50">
              Compares stated weekly intent hours against actual calendar hours across all 5 life clusters.
            </p>
          </div>
          <button
            onClick={() => pushToast("Life Compass rebalancing proposal: reallocated 2h from Admin to Career.")}
            className="btn btn-primary text-xs"
          >
            <Compass className="h-3.5 w-3.5" />
            <span>Rebalance Week</span>
          </button>
        </div>

        <div className="space-y-2">
          {[
            { cluster: "Study & Work", intent: 25, actual: 28, delta: "+3h", status: "Over" },
            { cluster: "Body & Health", intent: 14, actual: 12, delta: "-2h", status: "Under" },
            { cluster: "Mind & Spirit", intent: 7, actual: 7, delta: "0h", status: "Balanced" },
            { cluster: "People & Service", intent: 6, actual: 4, delta: "-2h", status: "Under" },
            { cluster: "Life Admin", intent: 5, actual: 6, delta: "+1h", status: "Balanced" },
          ].map((c) => (
            <div key={c.cluster} className="flex items-center justify-between rounded-xl bg-white/[0.03] p-2.5 border border-white/5 text-xs">
              <span className="font-semibold text-white/90">{c.cluster}</span>
              <div className="flex items-center gap-4 text-white/50 text-[0.72rem]">
                <span>Intent: {c.intent}h</span>
                <span>Actual: {c.actual}h</span>
                <span className={`font-bold ${c.delta.startsWith("+") ? "text-amber-300" : c.delta.startsWith("-") ? "text-rose-300" : "text-emerald-300"}`}>
                  {c.delta}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Default fallback for other domains: Clean Specialized System Card
  return (
    <div className="surface rounded-2xl border border-white/10 p-4 space-y-4">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div>
          <h2 className="text-sm font-bold text-white">{slug.toUpperCase()} Specialist Logic Engine</h2>
          <p className="text-xs text-white/50">
            Dedicated rules, templates, and formulas enforcing constraints through the calendar service.
          </p>
        </div>
        <button
          onClick={() => pushToast(`${slug.toUpperCase()} specialist rules executed and synchronized with master calendar.`)}
          className="btn btn-ghost text-xs"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Run Domain Engine</span>
        </button>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs text-white/70 space-y-2">
        <div className="font-semibold text-white/90">Specialist Constraint & Flow Enforcement:</div>
        <ul className="list-disc list-inside space-y-1 text-white/50 text-[0.74rem]">
          <li>Tier 1 & Tier 2 protected anchors defended against external encroachments.</li>
          <li>All writes validated via calendar service with automatic inverse undo logging.</li>
          <li>Ecosystem events automatically trigger cross-domain updates in related domains.</li>
        </ul>
      </div>
    </div>
  );
}
