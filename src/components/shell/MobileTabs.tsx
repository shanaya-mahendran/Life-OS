"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { MOBILE_NAV } from "./nav";
import { cn } from "@/lib/utils";

export function MobileTabs() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.07] bg-[#0a0716]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      <div className="relative mx-auto flex max-w-lg items-end justify-between px-3 py-2">
        {MOBILE_NAV.map((item, position) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          const isCentre = position === 2;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-1 text-[0.6rem] font-medium transition",
                active ? "text-violet-300" : "text-white/40",
                isCentre && "-mt-7",
              )}
            >
              <span
                className={cn(
                  "grid place-items-center rounded-2xl transition",
                  isCentre
                    ? "h-12 w-12 bg-gradient-to-br from-violet-400 via-violet-600 to-indigo-700 shadow-[0_10px_30px_-8px_rgba(124,92,255,0.9)]"
                    : "h-8 w-8",
                )}
              >
                <Icon
                  className={cn(isCentre ? "h-5 w-5 text-white" : "h-[18px] w-[18px]")}
                  strokeWidth={isCentre ? 2.2 : 1.9}
                />
              </span>
              {item.label}
            </Link>
          );
        })}
        <span className="pointer-events-none absolute left-1/2 top-0 h-px w-16 -translate-x-1/2 bg-gradient-to-r from-transparent via-violet-400/70 to-transparent" />
      </div>
    </nav>
  );
}

export function ChatFab() {
  const pathname = usePathname();
  if (pathname.startsWith("/chat")) return null;
  return (
    <Link
      href="/chat"
      className="fixed bottom-24 right-5 z-40 grid h-12 w-12 place-items-center rounded-full border border-violet-400/30 bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-[0_16px_40px_-12px_rgba(124,92,255,0.9)] lg:hidden"
      aria-label="Open chat"
    >
      <Sparkles className="h-5 w-5" />
    </Link>
  );
}
