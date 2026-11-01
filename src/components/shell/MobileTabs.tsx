"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MOBILE_NAV } from "./nav";
import { cn } from "@/lib/utils";

export function MobileTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-50 lg:hidden border-t border-white/[0.09] bg-[#080514]/92 backdrop-blur-2xl shadow-[0_-8px_30px_rgba(0,0,0,0.7)]"
      style={{
        paddingBottom: "max(env(safe-area-inset-bottom, 0px), 10px)",
      }}
    >
      {/* Top subtle ambient neon gradient line */}
      <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />

      <div className="relative mx-auto flex max-w-md items-end justify-around px-2 pt-1.5 pb-1">
        {MOBILE_NAV.map((item, index) => {
          const isChat = item.href === "/chat";
          const active =
            pathname === item.href ||
            (item.href !== "/today" && pathname.startsWith(`${item.href}/`)) ||
            (item.href === "/today" && (pathname === "/" || pathname === "/today"));
          const Icon = item.icon;

          if (isChat) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group relative -mt-6 flex flex-col items-center focus:outline-none"
                aria-label="Open LifeOS Chat Agent"
              >
                <div
                  className={cn(
                    "relative grid h-14 w-14 place-items-center rounded-full transition-all duration-300 active:scale-90",
                    "bg-gradient-to-br from-violet-400 via-violet-600 to-indigo-700",
                    "border-2 border-violet-300/40",
                    active
                      ? "shadow-[0_0_28px_rgba(167,139,250,0.85)] ring-4 ring-violet-500/30"
                      : "shadow-[0_0_20px_rgba(124,92,255,0.65)] hover:shadow-[0_0_26px_rgba(167,139,250,0.8)]"
                  )}
                >
                  {/* Subtle inner reflection shine */}
                  <span className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-t from-transparent via-white/10 to-white/30" />
                  <Icon className="relative h-6 w-6 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]" strokeWidth={2.4} />
                </div>
                <span
                  className={cn(
                    "mt-1 text-[0.68rem] font-semibold tracking-wide transition-colors",
                    active ? "text-violet-300" : "text-white/60 group-hover:text-white"
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex flex-1 flex-col items-center justify-center py-1 transition-all duration-200 active:scale-95 focus:outline-none",
                active ? "text-violet-300" : "text-white/45 hover:text-white/80"
              )}
            >
              <span
                className={cn(
                  "relative grid h-8 w-8 place-items-center rounded-xl transition-all duration-200",
                  active
                    ? "bg-violet-500/15 text-violet-300 shadow-[0_0_12px_rgba(139,92,246,0.35)]"
                    : "text-white/45 group-hover:text-white/80"
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 transition-transform duration-200 group-hover:scale-105",
                    active && "stroke-[2.2]"
                  )}
                />
              </span>
              <span
                className={cn(
                  "mt-0.5 text-[0.62rem] font-medium tracking-tight transition-colors",
                  active ? "text-violet-200 font-semibold" : "text-white/40 group-hover:text-white/70"
                )}
              >
                {item.label}
              </span>

              {/* Active dot indicator */}
              {active && (
                <span className="absolute bottom-0 h-1 w-1 rounded-full bg-violet-400 shadow-[0_0_6px_#a78bfa]" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// Deprecated: Chat is now elevated in the bottom MobileTabs bar directly.
export function ChatFab() {
  return null;
}
