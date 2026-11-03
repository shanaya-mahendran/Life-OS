"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BookOpen, RotateCcw, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { NAV_ITEMS } from "./nav";
import { cn } from "@/lib/utils";

export interface SidebarFeatures {
  resetPlan: boolean;
  habitTracker: boolean;
  diary: boolean;
}

interface SidebarProps {
  adherence: number;
  taskCount: number;
  eventPlanCount: number;
  eventAchievedCount: number;
  eventResolvedCount: number;
  mobileOpen: boolean;
  onClose: () => void;
  features?: SidebarFeatures;
}

export function Sidebar({
  adherence,
  taskCount,
  eventPlanCount,
  eventAchievedCount,
  eventResolvedCount,
  mobileOpen,
  onClose,
  features,
}: SidebarProps) {
  const pathname = usePathname();
  const personalTools = [
    features?.resetPlan && { href: "/reset", label: "Reset Plan", icon: RotateCcw },
    features?.habitTracker && { href: "/habits", label: "Habit Tracker", icon: Activity },
    features?.diary && { href: "/diary", label: "Diary", icon: BookOpen },
  ].filter((item) => item !== false && item !== undefined);

  const content = (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden border-r border-white/[0.06] bg-[var(--bg-surface)] px-4 pb-5 pt-5">
      <div className="flex items-center justify-between px-1">
        <Link href="/today" onClick={onClose}>
          <Logo />
        </Link>
        <button onClick={onClose} className="btn btn-quiet p-1.5 lg:hidden" aria-label="Close menu">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
        <nav aria-label="Main navigation" className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "group relative flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                  active
                    ? "bg-violet-500/10 text-violet-200"
                    : "text-white/65 hover:bg-white/[0.05] hover:text-white",
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-violet-300" />
                )}
                <Icon className={cn("h-[17px] w-[17px]", active ? "text-violet-300" : "text-white/35")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {personalTools.length > 0 && (
          <nav aria-label="Personal tools" className="space-y-1">
            <p className="px-3 pb-1 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-white/35">
              Personal tools
            </p>
            {personalTools.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                    active
                      ? "bg-violet-500/10 text-violet-200"
                      : "text-white/65 hover:bg-white/[0.05] hover:text-white",
                  )}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-violet-300" />
                  )}
                  <Icon className={cn("h-[17px] w-[17px]", active ? "text-violet-300" : "text-white/35")} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>

      {(taskCount > 0 || eventPlanCount > 0) && (
        <div className="surface-flat shrink-0 space-y-3 rounded-xl p-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-white">Weekly progress</div>
          </div>
          {taskCount > 0 && (
            <div>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs text-white/60">
                <span>Tasks</span>
                <span className="tabular-nums">{adherence}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-violet-300" style={{ width: `${Math.min(100, adherence)}%` }} />
              </div>
              <p className="mt-1 text-[0.65rem] text-white/45">{adherence}% of tasks complete</p>
            </div>
          )}
          {eventPlanCount > 0 && (
            <div>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs text-white/60">
                <span>Event plans</span>
                <span className="tabular-nums">
                  {eventAchievedCount}/{eventResolvedCount} achieved
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-emerald-300"
                  style={{
                    width: `${eventResolvedCount ? Math.round((eventAchievedCount / eventResolvedCount) * 100) : 0}%`,
                  }}
                />
              </div>
              <p className="mt-1 text-[0.65rem] text-white/45">
                {eventResolvedCount
                  ? `${eventAchievedCount} of ${eventResolvedCount} check-ins achieved`
                  : `${eventPlanCount} planned · no check-ins yet`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-[16.5rem] shrink-0 lg:block">{content}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
            aria-label="Close menu overlay"
          />
          <div className="relative h-full w-[17rem] animate-[rise_0.2s_ease-out]">{content}</div>
        </div>
      )}
    </>
  );
}
