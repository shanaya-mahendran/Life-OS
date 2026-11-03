"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
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
  mobileOpen: boolean;
  onClose: () => void;
  features?: SidebarFeatures;
}

export function Sidebar({ adherence, taskCount, mobileOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  const content = (
    <div className="flex h-full min-h-0 flex-col gap-5 border-r border-white/[0.06] bg-[var(--bg-surface)] px-4 pb-5 pt-5">
      <div className="flex items-center justify-between px-1">
        <Link href="/today" onClick={onClose}>
          <Logo />
        </Link>
        <button onClick={onClose} className="btn btn-quiet p-1.5 lg:hidden" aria-label="Close menu">
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav aria-label="Main navigation" className="shrink-0 space-y-1">
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

      <div className="min-h-0 flex-1 overflow-y-auto" />
      {taskCount > 0 && (
        <div className="surface-flat shrink-0 rounded-xl p-3.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-white">Weekly progress</div>
            <div className="text-sm font-semibold tabular-nums text-white">{adherence}%</div>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-violet-300" style={{ width: `${Math.min(100, adherence)}%` }} />
          </div>
          <p className="mt-2 text-xs text-white/60">{adherence}% of tasks complete</p>
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
