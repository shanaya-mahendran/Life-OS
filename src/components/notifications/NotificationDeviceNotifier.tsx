"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Triggers native OS / phone push notifications for LifeOS event alerts:
 * - 30 minutes before event
 * - 15 minutes before event
 * - 15 minutes after event (check-in)
 * - Morning brief & Weekly review
 */
export function NotificationDeviceNotifier({
  onCountChange,
}: {
  onCountChange?: (count: number) => void;
}) {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const notifiedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    setPermission(Notification.permission);

    // Load previously notified IDs from localStorage so we don't repeat alerts
    try {
      const stored = localStorage.getItem("lifeos_notified_ids");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          notifiedIdsRef.current = new Set(parsed.slice(-100)); // keep last 100
        }
      }
    } catch {
      // ignore
    }

    async function checkAndAlert() {
      try {
        const res = await fetch("/api/notifications");
        if (!res.ok) {
          console.error("[lifeos] Notification refresh failed:", res.status);
          return;
        }
        const data = await res.json();
        if (!data.ok) return;

        onCountChange?.(data.unreadCount ?? 0);

        if (Notification.permission !== "granted") return;

        const unread = (data.notifications ?? []).filter(
          (n: { id: string; status: string }) => n.status === "unread"
        );

        for (const notif of unread) {
          if (!notifiedIdsRef.current.has(notif.id)) {
            notifiedIdsRef.current.add(notif.id);

            // Save to localStorage
            try {
              localStorage.setItem(
                "lifeos_notified_ids",
                JSON.stringify(Array.from(notifiedIdsRef.current))
              );
            } catch {
              // ignore
            }

            // Trigger native notification via Service Worker if registered
            if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
              navigator.serviceWorker.controller.postMessage({
                type: "TRIGGER_NOTIFICATION",
                id: notif.id,
                title: notif.title,
                message: notif.message,
                link: notif.link || "/today",
              });
            } else {
              // Fallback to desktop/browser Notification API
              try {
                new Notification(notif.title, {
                  body: notif.message,
                  icon: "/icons/notification-badge.png",
                  badge: "/icons/notification-badge.png",
                  tag: notif.id,
                });
              } catch {
                // ignore
              }
            }
          }
        }
      } catch {
        // silent fail during network dips
      }
    }

    // Initial check on mount
    void checkAndAlert();

    // Poll every 30 seconds for upcoming event alerts
    const interval = setInterval(() => {
      void checkAndAlert();
    }, 30000);

    return () => clearInterval(interval);
  }, [onCountChange]);

  return null;
}

/** Helper to request native device notification permissions */
export async function requestDeviceNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;

  try {
    const result = await Notification.requestPermission();
    if (result === "granted") {
      // Test alert
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "TRIGGER_NOTIFICATION",
          title: "LifeOS Notifications Enabled 🔔",
          message: "You'll now receive alerts before and after each event on your schedule.",
          link: "/today",
        });
      }
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
