"use client";

import { useEffect, useState } from "react";
import { Sidebar, type SidebarFeatures } from "./Sidebar";
import { Topbar } from "./Topbar";
import { MobileTabs, ChatFab } from "./MobileTabs";
import { CommandPalette } from "./CommandPalette";
import { NotificationDrawer } from "@/components/notifications/NotificationDrawer";
import { NotificationDeviceNotifier } from "@/components/notifications/NotificationDeviceNotifier";
import { MobileInstallBanner } from "@/components/pwa/InstallButton";

interface AppShellProps {
  userName: string;
  adherence: number;
  taskCount: number;
  notificationCount: number;
  features?: SidebarFeatures;
  children: React.ReactNode;
}

export function AppShell({ userName, adherence, taskCount, notificationCount, features, children }: AppShellProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [count, setCount] = useState(notificationCount);

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
    <div className="relative flex min-h-dvh bg-void">
      <Sidebar
        adherence={adherence}
        taskCount={taskCount}
        mobileOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        features={features}
      />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <Topbar
          userName={userName}
          notificationCount={count}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenMenu={() => setMenuOpen(true)}
          onOpenNotifications={() => setNotificationsOpen(true)}
        />
        <MobileInstallBanner />
        <main className="mx-auto w-full max-w-[70rem] flex-1 px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8 pb-[calc(max(env(safe-area-inset-bottom,0px),16px)+6.5rem)] lg:pb-12">
          {children}
        </main>
      </div>

      <MobileTabs />
      <ChatFab />
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <NotificationDrawer
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        onCountChange={setCount}
      />
      <NotificationDeviceNotifier onCountChange={setCount} />
    </div>
  );
}
