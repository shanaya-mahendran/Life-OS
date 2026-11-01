"use client";

import { useEffect, useState } from "react";
import { Sidebar, type SidebarDomain } from "./Sidebar";
import { Topbar } from "./Topbar";
import { MobileTabs, ChatFab } from "./MobileTabs";
import { CommandPalette } from "./CommandPalette";

interface AppShellProps {
  userName: string;
  domains: SidebarDomain[];
  adherence: number;
  notificationCount: number;
  children: React.ReactNode;
}

export function AppShell({ userName, domains, adherence, notificationCount, children }: AppShellProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="relative flex min-h-dvh bg-[#06040e]">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="aurora-blob left-[-10%] top-[-12%] h-[560px] w-[560px] animate-aurora bg-violet-700/25" />
        <div className="aurora-blob bottom-[-18%] right-[-8%] h-[600px] w-[600px] animate-aurora bg-indigo-700/20" />
        <div className="aurora-blob left-[45%] top-[30%] h-[420px] w-[420px] bg-fuchsia-700/10" />
        <div
          className="absolute inset-0 opacity-[0.13]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.14) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
            maskImage: "radial-gradient(ellipse at 45% 20%, black, transparent 75%)",
          }}
        />
      </div>

      <Sidebar
        domains={domains}
        adherence={adherence}
        mobileOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
      />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <Topbar
          userName={userName}
          notificationCount={notificationCount}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenMenu={() => setMenuOpen(true)}
        />
        <main className="mx-auto w-full max-w-[100rem] flex-1 px-3 sm:px-4 lg:px-6 pt-3 sm:pt-5 pb-[calc(max(env(safe-area-inset-bottom,0px),16px)+6.5rem)] lg:pb-12">
          {children}
        </main>
      </div>

      <MobileTabs />
      <ChatFab />
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
