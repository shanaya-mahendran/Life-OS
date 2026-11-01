"use client";

import Link from "next/link";
import { Bell, Menu, Search } from "lucide-react";
import { initials } from "@/lib/utils";

interface TopbarProps {
  userName: string;
  notificationCount: number;
  onOpenSearch: () => void;
  onOpenMenu: () => void;
}

export function Topbar({ userName, notificationCount, onOpenSearch, onOpenMenu }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/[0.05] bg-[#08060f]/80 px-4 py-3 backdrop-blur-xl lg:px-6">
      <button onClick={onOpenMenu} className="btn btn-quiet p-2 lg:hidden" aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </button>

      <button
        onClick={onOpenSearch}
        className="group flex flex-1 items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.04] px-3.5 py-2 text-left transition hover:border-white/15 hover:bg-white/[0.06]"
      >
        <Search className="h-4 w-4 text-white/30" />
        <span className="flex-1 truncate text-[0.8rem] text-white/35">
          Search your schedule, tasks, or ask LifeOS…
        </span>
        <kbd className="hidden rounded-md border border-white/10 px-1.5 py-0.5 text-[0.6rem] text-white/30 sm:block">
          ⌘ K
        </kbd>
      </button>

      <Link
        href="/today#brief"
        className="relative grid h-9 w-9 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.04] text-white/55 transition hover:text-white"
        aria-label="Notifications"
      >
        <Bell className="h-[17px] w-[17px]" />
        {notificationCount > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[0.58rem] font-bold text-white">
            {notificationCount > 9 ? "9+" : notificationCount}
          </span>
        )}
      </Link>

      <Link href="/settings" className="flex items-center gap-2.5 rounded-xl px-1 py-1 transition hover:bg-white/[0.04]">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 via-violet-500 to-indigo-600 text-[0.72rem] font-bold text-white">
          {initials(userName)}
        </span>
        <span className="hidden text-[0.8rem] font-medium text-white/80 sm:block">{userName.split(" ")[0]}</span>
      </Link>
    </header>
  );
}
