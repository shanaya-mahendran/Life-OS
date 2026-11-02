"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, LayoutDashboard, Settings2, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/reset/plan", label: "Plan", icon: LayoutDashboard },
  { href: "/reset/builder", label: "Builder", icon: SlidersHorizontal },
  { href: "/reset/notebook", label: "Notebook", icon: BookOpen },
  { href: "/reset/reports", label: "Reports", icon: BarChart3 },
  { href: "/reset/settings", label: "Settings", icon: Settings2 },
];

export function ResetTabs() {
  const pathname = usePathname();

  return (
    <nav className="no-scrollbar -mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-0.5">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[0.72rem] font-semibold transition",
              active
                ? "border-violet-400/35 bg-violet-500/15 text-violet-100"
                : "border-white/[0.07] bg-white/[0.025] text-white/45 hover:border-white/15 hover:text-white/80",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
