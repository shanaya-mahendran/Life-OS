"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Download, Share2, Smartphone } from "lucide-react";

export function PwaInstallCard() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // Already running as installed PWA?
    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const isStandaloneNow =
      standaloneQuery.matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(isStandaloneNow);

    // Detect iOS
    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    // ── Pick up the globally-stashed prompt (captured in PwaRegister) ──
    if (window.__pwaInstallPrompt) {
      setDeferredPrompt(window.__pwaInstallPrompt);
    }

    // If PwaRegister captures it *after* this component mounts
    const onPromptReady = () => {
      if (window.__pwaInstallPrompt) {
        setDeferredPrompt(window.__pwaInstallPrompt);
      }
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("pwa-prompt-ready", onPromptReady);
    window.addEventListener("pwa-installed", onInstalled);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("pwa-prompt-ready", onPromptReady);
      window.removeEventListener("pwa-installed", onInstalled);
      window.removeEventListener("appinstalled", onInstalled);
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
    window.__pwaInstallPrompt = null;
  }

  // ── Already installed ────────────────────────────────────────
  if (isStandalone || installed) {
    return (
      <div className="flex items-center gap-3.5 rounded-2xl border border-emerald-500/30 bg-[linear-gradient(135deg,rgba(16,60,50,0.45),rgba(10,14,20,0.9))] p-4 shadow-lg">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-500/20 text-emerald-300 shadow-[0_0_15px_rgba(52,211,153,0.35)]">
          <CheckCircle2 className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className="font-display text-[0.92rem] font-bold text-white">
            LifeOS App Installed ✓
          </div>
          <div className="mt-0.5 text-[0.72rem] text-white/50">
            Running as a native standalone Progressive Web App.
          </div>
        </div>
      </div>
    );
  }

  // ── Install Card ─────────────────────────────────────────────
  return (
    <div className="relative overflow-hidden rounded-3xl border border-violet-400/25 bg-[linear-gradient(135deg,rgba(40,20,85,0.7),rgba(15,10,28,0.92))] p-4 sm:p-5 shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-violet-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -left-8 bottom-0 h-32 w-32 rounded-full bg-fuchsia-500/15 blur-3xl" />

      <div className="relative flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start gap-3.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-violet-300/30 bg-violet-600/30 text-violet-200 shadow-[0_0_20px_rgba(139,92,246,0.5)]">
            <Smartphone className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-display text-[1rem] font-bold text-white">
                Install LifeOS App
              </span>
              <span className="rounded-full bg-violet-500/25 border border-violet-400/30 px-2 py-0.5 text-[0.6rem] font-semibold text-violet-200 uppercase tracking-wider">
                PWA
              </span>
            </div>
            <p className="mt-1 text-[0.78rem] text-white/55 leading-relaxed">
              Add LifeOS to your home screen for instant launch, fullscreen mode, and offline access — no app store needed.
            </p>
          </div>
        </div>

        {/* ── Native install button (Chrome/Edge/Samsung on HTTPS or localhost) ── */}
        {deferredPrompt && (
          <button
            onClick={() => void handleInstallClick()}
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-600 px-5 py-3 text-[0.88rem] font-bold text-white shadow-[0_0_24px_rgba(124,92,255,0.6)] transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_0_32px_rgba(124,92,255,0.8)] active:scale-95"
          >
            <Download className="h-5 w-5" />
            Install LifeOS Now
          </button>
        )}

        {/* ── iOS Safari instructions ── */}
        {!deferredPrompt && isIOS && (
          <div className="space-y-3">
            <button
              onClick={() => setShowIOSGuide(!showIOSGuide)}
              className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-600 px-5 py-3 text-[0.88rem] font-bold text-white shadow-[0_0_24px_rgba(124,92,255,0.6)] transition-all duration-200 hover:scale-[1.02] active:scale-95"
            >
              <Download className="h-5 w-5" />
              How to Install on iPhone
            </button>

            {showIOSGuide && (
              <div className="space-y-2.5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 animate-rise">
                <p className="text-[0.72rem] font-semibold text-white/80 uppercase tracking-wider">Follow these steps:</p>
                <div className="flex items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-violet-500/20 text-[0.72rem] font-bold text-violet-200">1</span>
                  <span className="text-[0.8rem] text-white/75">Tap the <Share2 className="inline h-4 w-4 text-sky-300 mx-0.5 -mt-0.5" /> <strong className="text-white">Share</strong> button in Safari&apos;s toolbar</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-violet-500/20 text-[0.72rem] font-bold text-violet-200">2</span>
                  <span className="text-[0.8rem] text-white/75">Scroll down and tap <strong className="text-white">&quot;Add to Home Screen&quot;</strong></span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-violet-500/20 text-[0.72rem] font-bold text-violet-200">3</span>
                  <span className="text-[0.8rem] text-white/75">Tap <strong className="text-white">&quot;Add&quot;</strong> — LifeOS appears on your home screen!</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Desktop / Android fallback (no beforeinstallprompt yet) ── */}
        {!deferredPrompt && !isIOS && (
          <div className="space-y-3">
            <div className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-violet-400/30 bg-violet-500/10 px-5 py-3 text-[0.84rem] font-semibold text-violet-200">
              <Download className="h-5 w-5" />
              Install from Your Browser
            </div>

            <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[0.72rem] font-semibold text-white/80 uppercase tracking-wider">How to install:</p>
              <div className="flex items-start gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-violet-500/20 text-[0.68rem] font-bold text-violet-200 mt-0.5">1</span>
                <div>
                  <span className="text-[0.8rem] text-white/80 font-medium">Chrome / Edge</span>
                  <p className="text-[0.72rem] text-white/50 mt-0.5">Click the <strong className="text-white/80">install icon</strong> (⊕) in the address bar, or go to <strong className="text-white/80">⋮ → Install LifeOS</strong></p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-violet-500/20 text-[0.68rem] font-bold text-violet-200 mt-0.5">2</span>
                <div>
                  <span className="text-[0.8rem] text-white/80 font-medium">Android Chrome</span>
                  <p className="text-[0.72rem] text-white/50 mt-0.5">Tap <strong className="text-white/80">⋮ → Add to Home screen</strong> or look for the install banner</p>
                </div>
              </div>
              <p className="mt-2 text-[0.68rem] text-white/35 italic">
                Note: On localhost the native install button may not appear. Deploy to Vercel (HTTPS) for the full &quot;Install App Now&quot; experience.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
