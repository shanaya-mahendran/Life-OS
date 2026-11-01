"use client";

import { useEffect } from "react";

/**
 * Extends the global Window interface so we can stash the
 * beforeinstallprompt event for the install card to pick up later.
 */
declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
  interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  }
  interface Window {
    /** Captured by PwaRegister so InstallButton can use it later. */
    __pwaInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // ── 1. Register the Service Worker ──────────────────────────
    if ("serviceWorker" in navigator) {
      const registerSW = () => {
        navigator.serviceWorker
          .register("/sw.js", { scope: "/" })
          .then((registration) => {
            registration.onupdatefound = () => {
              const installingWorker = registration.installing;
              if (installingWorker) {
                installingWorker.onstatechange = () => {
                  if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
                    console.log("[PWA] New content is available; please refresh.");
                  }
                };
              }
            };
          })
          .catch((error) => {
            console.warn("[PWA] ServiceWorker registration failed:", error);
          });
      };

      if (document.readyState === "complete" || document.readyState === "interactive") {
        registerSW();
      } else {
        window.addEventListener("load", registerSW);
      }
    }

    // ── 2. Capture beforeinstallprompt globally ─────────────────
    //    This event fires only once, very early. If the user hasn't
    //    opened Settings yet the InstallButton would miss it.
    //    Stash it on window so any component can grab it later.
    const handleBeforeInstallPrompt = (event: BeforeInstallPromptEvent) => {
      event.preventDefault(); // stop the mini-infobar on mobile
      window.__pwaInstallPrompt = event;
      // Dispatch a custom event so already-mounted components can react
      window.dispatchEvent(new CustomEvent("pwa-prompt-ready"));
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    window.addEventListener("appinstalled", () => {
      window.__pwaInstallPrompt = null;
      window.dispatchEvent(new CustomEvent("pwa-installed"));
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  return null;
}
