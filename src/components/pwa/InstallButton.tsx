"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Download, Share2, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function PwaInstallCard() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Check if running in standalone mode (already installed)
    const isStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(isStandaloneMode);

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isAppleDevice);

    // Listen for Chrome/Edge/Android PWA install prompt event
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    window.addEventListener("appinstalled", () => {
      setInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
    }
    setDeferredPrompt(null);
  }

  if (isStandalone || installed) {
    return (
      <div className="surface flex items-center gap-3.5 p-4 border-emerald-500/25 bg-emerald-500/[0.05]">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-500/20 text-emerald-300 shadow-[0_0_15px_rgba(52,211,153,0.3)]">
          <CheckCircle2 className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className="font-display text-[0.92rem] font-bold text-white">LifeOS App Installed</div>
          <div className="mt-0.5 text-[0.72rem] text-white/50">Running as a native standalone Progressive Web App.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="surface relative overflow-hidden rounded-3xl border border-violet-400/25 bg-[linear-gradient(135deg,rgba(40,20,85,0.7),rgba(15,10,28,0.92))] p-4 sm:p-5 shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
      <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-violet-500/20 blur-3xl" />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-violet-300/30 bg-violet-600/30 text-violet-200 shadow-[0_0_20px_rgba(139,92,246,0.5)]">
            <Smartphone className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="font-display text-[1rem] font-bold text-white flex items-center gap-2">
              <span>Download LifeOS to Your Phone</span>
              <span className="rounded-full bg-violet-500/25 border border-violet-400/30 px-2 py-0.5 text-[0.62rem] font-semibold text-violet-200">
                PWA Ready
              </span>
            </div>
            <p className="mt-1 text-[0.78rem] text-white/55 leading-relaxed">
              Install LifeOS directly to your home screen with zero app store hassle. Enjoy instant startup, offline access, and a full native fullscreen experience.
            </p>
          </div>
        </div>

        {deferredPrompt ? (
          <button
            onClick={() => void handleInstallClick()}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 px-4 py-2.5 text-[0.82rem] font-bold text-white shadow-[0_0_20px_rgba(124,92,255,0.6)] transition-all hover:scale-105 active:scale-95"
          >
            <Download className="h-4 w-4" /> Install App Now
          </button>
        ) : isIOS ? (
          <div className="flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2 text-[0.75rem] text-white/80">
            <Share2 className="h-4 w-4 text-violet-300 shrink-0" />
            <span>Tap <strong>Share</strong> then <strong>“Add to Home Screen”</strong></span>
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[0.75rem] text-white/60">
            <Download className="h-3.5 w-3.5 text-white/40" />
            <span>Click <strong>Install</strong> in browser bar</span>
          </div>
        )}
      </div>
    </div>
  );
}
