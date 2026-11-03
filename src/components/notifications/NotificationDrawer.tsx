"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  Clock,
  Sparkles,
  Sun,
  Trophy,
  X,
  XCircle,
  Loader2,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface UiNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  status: string;
  link: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface NotificationDrawerProps {
  open: boolean;
  onClose: () => void;
  onCountChange?: (count: number) => void;
}

export function NotificationDrawer({ open, onClose, onCountChange }: NotificationDrawerProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<UiNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionErrorId, setActionErrorId] = useState<string | null>(null);
  const [perm, setPerm] = useState<NotificationPermission>("default");
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPerm(Notification.permission);
    }
  }, [open]);

  async function requestPerm() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const res = await Notification.requestPermission();
    setPerm(res);
    if (res === "granted" && "serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "TRIGGER_NOTIFICATION",
        title: "Phone Notifications Active 🔔",
        message: "You'll now receive timely alerts 30m before, 15m before, and 15m after your events!",
        link: "/today",
      });
    }
  }

  function sendTestAlert() {
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "TRIGGER_NOTIFICATION",
        title: "Test Alert: Mentoring in 15m 🔔",
        message: "Starts at 3:00 PM. Your phone notifications are working perfectly!",
        link: "/calendar",
      });
    } else if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      new Notification("Test Alert: Mentoring in 15m 🔔", {
        body: "Starts at 3:00 PM. Your phone notifications are working perfectly!",
        icon: "/icons/notification-badge.png",
      });
    }
  }

  async function fetchNotifications() {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await fetch("/api/notifications");
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Could not load notifications.");
      setNotifications(data.notifications ?? []);
      onCountChange?.(data.unreadCount ?? 0);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      void fetchNotifications();
    }
  }, [open]);

  async function markAllRead() {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      setNotifications((current) => current.map((n) => ({ ...n, status: "read" })));
      onCountChange?.(0);
    } catch {
      // ignore
    }
  }

  async function handleConfirm(notificationId: string, achieved: boolean) {
    setActionBusyId(notificationId);
    setActionError(null);
    setActionErrorId(null);
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId, achieved }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Could not save this check-in.");
      setNotifications((current) =>
        current.map((n) =>
          n.id === notificationId ? { ...n, status: achieved ? "confirmed_achieved" : "confirmed_missed" } : n,
        ),
      );
      startTransition(() => router.refresh());
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not save this check-in.");
      setActionErrorId(notificationId);
    } finally {
      setActionBusyId(null);
    }
  }

  if (!open) return null;

  const unreadCount = notifications.filter((n) => n.status === "unread").length;

  return (
    <div className="fixed inset-0 z-[120] flex justify-end">
      {/* Backdrop */}
      <button
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        aria-label="Close notifications backdrop"
      />

      {/* Slide-out Panel */}
      <aside
        className={cn(
          "relative flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#090616] p-4 shadow-2xl",
          "animate-[rise_0.24s_cubic-bezier(0.22,1,0.36,1)]",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3.5">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-500/15 text-violet-300">
              <Bell className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-display text-[0.95rem] font-semibold text-white">Notifications</h2>
              <p className="text-[0.65rem] text-white/40">
                {unreadCount > 0 ? `${unreadCount} unread alert${unreadCount > 1 ? "s" : ""}` : "All caught up"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <button
                onClick={() => void markAllRead()}
                className="btn btn-quiet text-[0.68rem] text-white/60 hover:text-white"
              >
                Mark all read
              </button>
            )}
            <button onClick={onClose} className="btn btn-quiet p-1.5" aria-label="Close panel">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Device Notification Status / Prompt */}
        <div className="mt-3 rounded-2xl border border-violet-500/25 bg-[linear-gradient(135deg,rgba(40,20,80,0.5),rgba(15,10,25,0.7))] p-3 text-[0.72rem]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${perm === "granted" ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-amber-400 shadow-[0_0_8px_#fbbf24]"}`} />
              <span className="font-semibold text-white/90">
                {perm === "granted" ? "Phone Alerts Active" : "Enable Phone & Lockscreen Alerts"}
              </span>
            </div>
            {perm !== "granted" ? (
              <button
                type="button"
                onClick={() => void requestPerm()}
                className="rounded-xl bg-violet-600 px-2.5 py-1 text-[0.65rem] font-bold text-white shadow-sm hover:bg-violet-500 active:scale-95 transition"
              >
                Enable
              </button>
            ) : (
              <button
                type="button"
                onClick={sendTestAlert}
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-[0.62rem] text-violet-300 hover:bg-white/10"
              >
                Test Alert
              </button>
            )}
          </div>
          <p className="mt-1 text-[0.65rem] text-white/45 leading-relaxed">
            {perm === "granted"
              ? "You'll receive alerts 30m and 15m before each block, plus a 15m achievement check-in."
              : "Allow notifications to receive reminder alerts directly in your phone notification shade."}
          </p>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
          {loadError && (
            <div role="alert" className="rounded-xl border border-rose-400/20 bg-rose-500/[0.08] p-3 text-sm text-rose-100">
              <p>{loadError}</p>
              <button type="button" onClick={() => void fetchNotifications()} className="mt-2 text-xs underline">
                Try again
              </button>
            </div>
          )}
          {loading && notifications.length === 0 ? (
            <div className="grid h-40 place-items-center text-white/40">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-center px-4">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.04] text-white/30 mb-2">
                <CheckCircle2 className="h-6 w-6" />
              </span>
              <p className="text-[0.84rem] font-medium text-white/70">No notifications yet</p>
              <p className="mt-1 text-[0.7rem] text-white/40 leading-relaxed max-w-xs">
                You’ll get automatic alerts 30m and 15m before events, and a check-in 15m after to confirm whether your plan was achieved!
              </p>
            </div>
          ) : (
            notifications.map((item) => {
              const isUnread = item.status === "unread";
              const isAchievementCheck = item.type.startsWith("after_15m");
              const isMorning = item.type === "morning_brief";
              const isReview = item.type === "review";
              const is30m = item.type.startsWith("before_30m");
              const is15m = item.type.startsWith("before_15m");
              const isBusy = actionBusyId === item.id;

              return (
                <div
                  key={item.id}
                  className={cn(
                    "relative rounded-2xl border p-3.5 transition-all",
                    isUnread
                      ? "border-violet-400/30 bg-violet-500/[0.08] shadow-[0_0_20px_rgba(139,92,246,0.12)]"
                      : "border-white/[0.06] bg-white/[0.03] text-white/70",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white",
                        isAchievementCheck
                          ? "bg-amber-500/20 text-amber-300"
                          : isMorning
                          ? "bg-amber-400/20 text-amber-200"
                          : isReview
                          ? "bg-indigo-500/20 text-indigo-300"
                          : is30m
                          ? "bg-blue-500/20 text-blue-300"
                          : "bg-violet-500/20 text-violet-300",
                      )}
                    >
                      {isAchievementCheck ? (
                        <Trophy className="h-3.5 w-3.5" />
                      ) : isMorning ? (
                        <Sun className="h-3.5 w-3.5" />
                      ) : isReview ? (
                        <Sparkles className="h-3.5 w-3.5" />
                      ) : is30m || is15m ? (
                        <Clock className="h-3.5 w-3.5" />
                      ) : (
                        <CalendarDays className="h-3.5 w-3.5" />
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-[0.82rem] font-semibold text-white leading-tight">{item.title}</h3>
                        {isUnread && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400 shadow-[0_0_6px_#a78bfa]" />
                        )}
                      </div>
                      <p className="mt-1 text-[0.74rem] text-white/60 leading-relaxed">{item.message}</p>

                      {/* Interactive Confirmation Buttons for Post-Event 15m Check-in */}
                      {isAchievementCheck && (
                        <div className="mt-2.5">
                          {item.status === "confirmed_achieved" ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-0.5 text-[0.68rem] font-semibold text-emerald-200">
                              <CheckCircle2 className="h-3 w-3" /> Plan Achieved!
                            </span>
                          ) : item.status === "confirmed_missed" ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/30 bg-rose-500/15 px-2.5 py-0.5 text-[0.68rem] font-semibold text-rose-200">
                              <XCircle className="h-3 w-3" /> Missed / Rescheduled
                            </span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => void handleConfirm(item.id, true)}
                                disabled={isBusy}
                                className="btn btn-primary px-3 py-1 text-[0.72rem] shadow-[0_0_15px_rgba(168,85,247,0.3)]"
                              >
                                {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                                Achieved!
                              </button>
                              <button
                                onClick={() => void handleConfirm(item.id, false)}
                                disabled={isBusy}
                                className="btn btn-ghost px-2.5 py-1 text-[0.72rem] text-white/50 hover:text-white"
                              >
                                Missed
                              </button>
                            </div>
                          )}
                          {actionError && actionErrorId === item.id && (
                            <p role="alert" className="mt-2 text-xs text-rose-200">{actionError}</p>
                          )}
                        </div>
                      )}

                      {/* Deep Link if present */}
                      {!isAchievementCheck && item.link && (
                        <Link
                          href={item.link}
                          onClick={onClose}
                          className="mt-2 inline-block text-[0.68rem] font-medium text-violet-300 hover:text-violet-200 underline underline-offset-2"
                        >
                          View in app →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="border-t border-white/[0.08] pt-3 text-center">
          <p className="text-[0.62rem] text-white/35">
            Auto-notifications · 30m & 15m before events · 15m after check-in
          </p>
        </div>
      </aside>
    </div>
  );
}
