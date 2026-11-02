"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BookOpen, ChevronRight, LogOut, RotateCcw, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { NAV_ITEMS } from "./nav";
import { cn, withAlpha } from "@/lib/utils";
import { SidebarInstallButton } from "@/components/pwa/InstallButton";
import { signOutUser } from "@/lib/auth-client";

export interface SidebarDomain {
  slug: string;
  name: string;
  accent: string;
  isProtected: boolean;
}

export interface SidebarFeatures {
  resetPlan: boolean;
  habitTracker: boolean;
  diary: boolean;
}

interface SidebarProps {
  domains: SidebarDomain[];
  adherence: number;
  mobileOpen: boolean;
  onClose: () => void;
  features?: SidebarFeatures;
}

export function Sidebar({ domains, adherence, mobileOpen, onClose, features }: SidebarProps) {
  const pathname = usePathname();
  const showReset = features?.resetPlan ?? false;
  const showHabits = features?.habitTracker ?? false;
  const showDiary = features?.diary ?? false;

  const content = (
    <div className="flex h-full flex-col gap-5 border-r border-white/[0.06] bg-[linear-gradient(180deg,rgba(15,10,30,0.96),rgba(8,6,18,0.98))] px-4 pb-5 pt-5">
      <div className="flex items-center justify-between px-1">
        <Link href="/today" onClick={onClose}>
          <Logo />
        </Link>
        <button onClick={onClose} className="btn btn-quiet p-1.5 lg:hidden" aria-label="Close menu">
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.85rem] font-medium transition",
                active
                  ? "bg-gradient-to-r from-violet-600/35 via-violet-600/15 to-transparent text-white"
                  : "text-white/55 hover:bg-white/[0.05] hover:text-white/85",
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-violet-400 shadow-[0_0_14px_2px_rgba(167,139,250,0.75)]" />
              )}
              <Icon className={cn("h-[17px] w-[17px]", active ? "text-violet-300" : "text-white/35")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {(showReset || showHabits || showDiary) && (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-1.5">
          <div className="flex items-center justify-between px-2 pb-1 pt-1">
            <span className="text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-white/30">
              Your systems
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/70 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
          </div>

          {showReset && (
            <Link
              href="/reset"
              onClick={onClose}
              className={cn(
                "group flex min-h-[44px] items-center gap-2.5 rounded-xl px-2.5 py-2 transition",
                pathname === "/reset" || pathname.startsWith("/reset/")
                  ? "bg-gradient-to-r from-violet-600/30 to-transparent text-white"
                  : "text-white/55 hover:bg-white/[0.05] hover:text-white/90",
              )}
            >
              <span
                className={cn(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-lg border",
                  pathname.startsWith("/reset")
                    ? "border-violet-400/40 bg-violet-500/20 text-violet-200"
                    : "border-white/10 bg-white/[0.04] text-white/40 group-hover:text-violet-200",
                )}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.8rem] font-semibold">Reset Plan</span>
                <span className="block truncate text-[0.6rem] text-white/30">90 days, one program</span>
              </span>
              <ChevronRight className="h-3 w-3 shrink-0 text-white/0 transition group-hover:text-white/30" />
            </Link>
          )}

          {showHabits && (
            <Link
              href="/habits"
              onClick={onClose}
              className={cn(
                "group flex min-h-[44px] items-center gap-2.5 rounded-xl px-2.5 py-2 transition",
                pathname === "/habits" || pathname.startsWith("/habits/")
                  ? "bg-gradient-to-r from-emerald-600/25 to-transparent text-white"
                  : "text-white/55 hover:bg-white/[0.05] hover:text-white/90",
              )}
            >
              <span
                className={cn(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-lg border",
                  pathname.startsWith("/habits")
                    ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
                    : "border-white/10 bg-white/[0.04] text-white/40 group-hover:text-emerald-200",
                )}
              >
                <Activity className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.8rem] font-semibold">Habit Tracker</span>
                <span className="block truncate text-[0.6rem] text-white/30">Streaks &amp; goal progress</span>
              </span>
              <ChevronRight className="h-3 w-3 shrink-0 text-white/0 transition group-hover:text-white/30" />
            </Link>
          )}

          {showDiary && (
            <Link
              href="/diary"
              onClick={onClose}
              className={cn(
                "group flex min-h-[44px] items-center gap-2.5 rounded-xl px-2.5 py-2 transition",
                pathname === "/diary" || pathname.startsWith("/diary/")
                  ? "bg-gradient-to-r from-amber-600/25 to-transparent text-white"
                  : "text-white/55 hover:bg-white/[0.05] hover:text-white/90",
              )}
            >
              <span
                className={cn(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-lg border",
                  pathname.startsWith("/diary")
                    ? "border-amber-400/40 bg-amber-500/15 text-amber-200"
                    : "border-white/10 bg-white/[0.04] text-white/40 group-hover:text-amber-200",
                )}
              >
                <BookOpen className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.8rem] font-semibold">Diary</span>
                <span className="block truncate text-[0.6rem] text-white/30">Private pages &amp; mirrors</span>
              </span>
              <ChevronRight className="h-3 w-3 shrink-0 text-white/0 transition group-hover:text-white/30" />
            </Link>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1">
        <div className="mb-2 flex items-center justify-between px-2">
          <span className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-white/30">
            18 Domains
          </span>
          <span className="text-[0.6rem] text-white/20">all on</span>
        </div>
        <div className="scroll-thin max-h-[calc(100dvh-31.5rem)] space-y-0.5 overflow-y-auto pr-1 lg:max-h-[calc(100dvh-28.5rem)]">
          {domains.map((domain) => {
            const active = pathname === `/domains/${domain.slug}`;
            return (
              <Link
                key={domain.slug}
                href={`/domains/${domain.slug}`}
                onClick={onClose}
                className={cn(
                  "group flex items-center gap-2.5 rounded-lg px-2 py-[0.4rem] text-[0.79rem] transition",
                  active ? "bg-white/[0.07] text-white" : "text-white/55 hover:bg-white/[0.04] hover:text-white/85",
                )}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor: domain.accent,
                    boxShadow: `0 0 8px ${withAlpha(domain.accent, 0.65)}`,
                  }}
                />
                <span className="truncate">{domain.name}</span>
                <ChevronRight className="ml-auto h-3 w-3 shrink-0 text-white/0 transition group-hover:text-white/30" />
              </Link>
            );
          })}
        </div>
      </div>

      <div className="surface-accent rounded-2xl p-3.5" style={{ "--accent": "#7c5cff" } as React.CSSProperties}>
        <div className="mb-2.5 flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-violet-500/25 text-[0.7rem]">✓</span>
          <div className="text-[0.76rem] font-semibold text-white/90">You&apos;re on track</div>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400"
            style={{ width: `${Math.max(6, Math.min(100, adherence))}%` }}
          />
        </div>
        <p className="mt-2 text-[0.66rem] text-white/45">{adherence}% of this week&apos;s tasks done</p>
      </div>

      <div className="mt-auto space-y-2 pt-2 border-t border-white/[0.06]">
        <SidebarInstallButton />
        <button
          type="button"
          onClick={() => void signOutUser()}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[0.8rem] font-medium text-white/50 transition hover:bg-rose-500/10 hover:text-rose-300"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign out</span>
        </button>
      </div>
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
