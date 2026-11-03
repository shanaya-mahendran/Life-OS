"use client";

import Link from "next/link";
import Image from "next/image";
import { Bell, LogOut, Menu, Search } from "lucide-react";
import { initials } from "@/lib/utils";
import { signOutUser } from "@/lib/auth-client";

interface TopbarProps {
  userName: string;
  notificationCount: number;
  onOpenSearch: () => void;
  onOpenMenu: () => void;
  onOpenNotifications?: () => void;
}

export function Topbar({ userName, notificationCount, onOpenSearch, onOpenMenu, onOpenNotifications }: TopbarProps) {
  const firstName = userName.split(" ")[0];

  return (
    <header
      className="sticky top-0 z-40 border-b border-white/[0.08] bg-void px-4 backdrop-blur-xl transition-all lg:px-6"
      style={{
        paddingTop: "max(env(safe-area-inset-top, 0px), 8px)",
        paddingBottom: "8px",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        {/* Mobile Hamburger & Brand */}
        <div className="flex items-center gap-2 lg:hidden">
          <button
            type="button"
            onClick={onOpenMenu}
            className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/70 transition hover:bg-white/10 hover:text-white active:scale-95"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/today" className="flex items-center gap-2 focus:outline-none">
            <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-lg shadow-[0_0_12px_rgba(124,92,255,0.4)]">
              <Image
                src="/icons/icon-192.png"
                alt="LifeOS"
                width={28}
                height={28}
                className="h-full w-full object-cover"
                priority
              />
            </div>
            <span className="font-display text-sm font-bold tracking-tight text-white">
              Life<span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">OS</span>
            </span>
          </Link>
        </div>

        {/* Desktop Search Bar */}
        <button
          onClick={onOpenSearch}
          className="group hidden lg:flex flex-1 items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.04] px-3.5 py-2 text-left transition hover:border-white/15 hover:bg-white/[0.06]"
        >
          <Search className="h-4 w-4 text-white/30" />
          <span className="flex-1 truncate text-[0.8rem] text-white/35">
            Search your schedule, tasks, or ask LifeOS…
          </span>
          <kbd className="hidden rounded-md border border-white/10 px-1.5 py-0.5 text-[0.6rem] text-white/30 sm:block">
            ⌘ K
          </kbd>
        </button>

        {/* Right Action Icons & Avatar */}
        <div className="flex items-center gap-2">
          {/* Mobile Search Icon */}
          <button
            onClick={onOpenSearch}
            className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.04] text-white/60 transition hover:text-white lg:hidden"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </button>

          {/* Notifications Bell */}
          <button
            onClick={onOpenNotifications}
            className="relative grid h-9 w-9 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.04] text-white/60 transition hover:text-white"
            aria-label={notificationCount > 0 ? `${notificationCount} unread notifications` : "Open notifications"}
          >
            <Bell className="h-4 w-4" />
            {notificationCount > 0 && (
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[0.55rem] font-bold text-white shadow-sm">
                {notificationCount > 9 ? "9+" : notificationCount}
              </span>
            )}
          </button>

          {/* User Avatar with active green dot */}
          <Link href="/settings" className="relative flex items-center focus:outline-none" title="Open Settings">
            <div className="relative grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 via-violet-500 to-indigo-600 text-[0.72rem] font-bold text-white shadow-[0_0_12px_rgba(168,85,247,0.35)] ring-2 ring-white/10">
              {initials(userName)}
              {/* Online indicator dot as in user reference */}
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#070412] bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            </div>
            <span className="hidden text-[0.8rem] font-medium text-white/80 sm:ml-2 sm:block">{firstName}</span>
          </Link>

          {/* Quick Sign Out Button */}
          <button
            type="button"
            onClick={() => void signOutUser()}
            title="Sign out of LifeOS"
            className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.04] text-white/50 transition hover:bg-rose-500/15 hover:border-rose-500/30 hover:text-rose-200"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
