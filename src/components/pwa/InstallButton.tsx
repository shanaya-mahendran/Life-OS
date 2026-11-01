"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Laptop,
  Monitor,
  Share2,
  Smartphone,
  X,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";

/**
 * Creates and downloads a direct desktop shortcut (.url file)
 * that opens LifeOS in the user's browser / window.
 */
export function downloadDesktopShortcut(): void {
  if (typeof window === "undefined") return;
  const currentUrl = window.location.origin;
  const content = `[InternetShortcut]\r\nURL=${currentUrl}/\r\nIconIndex=0\r\n`;
  const blob = new Blob([content], { type: "application/internet-shortcut" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "LifeOS-App.url";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Triggers the install prompt if available, or dispatches lifeos-open-install.
 */
export async function triggerAppInstall(): Promise<void> {
  if (typeof window === "undefined") return;

  if (window.__pwaInstallPrompt) {
    try {
      await window.__pwaInstallPrompt.prompt();
      const choice = await window.__pwaInstallPrompt.userChoice;
      if (choice.outcome === "accepted") {
        window.dispatchEvent(new CustomEvent("pwa-installed"));
      }
      window.__pwaInstallPrompt = null;
      return;
    } catch {
      // Fall through to opening modal
    }
  }

  window.dispatchEvent(new CustomEvent("lifeos-open-install"));
}

export function InstallModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [platformTab, setPlatformTab] = useState<"desktop" | "ios" | "android">("desktop");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setPlatformTab("ios");
    } else if (/android/.test(ua)) {
      setPlatformTab("android");
    } else {
      setPlatformTab("desktop");
    }
  }, [open]);

  function copyLink() {
    if (typeof window === "undefined") return;
    navigator.clipboard.writeText(window.location.origin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Download & Install LifeOS App"
      subtitle="Install LifeOS on your device for full-screen view, instant offline launch & desktop shortcut."
      size="md"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2.5 w-full">
          <button
            onClick={downloadDesktopShortcut}
            className="flex items-center gap-2 rounded-xl border border-violet-400/40 bg-violet-600/25 px-3 py-2 text-[0.78rem] font-semibold text-violet-200 transition hover:bg-violet-600/40"
          >
            <Download className="h-4 w-4" />
            Download Desktop Launcher (.url)
          </button>
          <button onClick={onClose} className="btn btn-primary text-[0.78rem] ml-auto">
            Got it
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Platform tabs */}
        <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-white/[0.04] p-1 border border-white/10">
          <button
            type="button"
            onClick={() => setPlatformTab("desktop")}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-[0.75rem] font-medium transition ${
              platformTab === "desktop"
                ? "bg-violet-600 text-white shadow-md font-semibold"
                : "text-white/60 hover:text-white"
            }`}
          >
            <Monitor className="h-3.5 w-3.5" />
            Desktop
          </button>
          <button
            type="button"
            onClick={() => setPlatformTab("android")}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-[0.75rem] font-medium transition ${
              platformTab === "android"
                ? "bg-violet-600 text-white shadow-md font-semibold"
                : "text-white/60 hover:text-white"
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" />
            Android
          </button>
          <button
            type="button"
            onClick={() => setPlatformTab("ios")}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-[0.75rem] font-medium transition ${
              platformTab === "ios"
                ? "bg-violet-600 text-white shadow-md font-semibold"
                : "text-white/60 hover:text-white"
            }`}
          >
            <Share2 className="h-3.5 w-3.5" />
            iPhone / iPad
          </button>
        </div>

        {/* Desktop Tab */}
        {platformTab === "desktop" && (
          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-[0.8rem]">
            <div className="flex items-start gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-violet-500/20 text-xs font-bold text-violet-300">
                1
              </span>
              <div>
                <span className="font-semibold text-white">Browser Address Bar (Chrome / Edge / Brave):</span>
                <p className="mt-0.5 text-white/60 text-[0.75rem]">
                  Look at the right side of the URL address bar at the top of your screen. Click the{" "}
                  <strong className="text-violet-300">Install icon (⊕ or computer screen)</strong> and choose{" "}
                  <strong className="text-white">&quot;Install&quot;</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-violet-500/20 text-xs font-bold text-violet-300">
                2
              </span>
              <div>
                <span className="font-semibold text-white">Via Browser Menu:</span>
                <p className="mt-0.5 text-white/60 text-[0.75rem]">
                  Click the three vertical dots <strong className="text-white">⋮</strong> in the top-right corner →{" "}
                  <strong className="text-white">&quot;Save and share&quot;</strong> →{" "}
                  <strong className="text-violet-300">&quot;Install LifeOS as an App&quot;</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-violet-500/20 text-xs font-bold text-violet-300">
                3
              </span>
              <div>
                <span className="font-semibold text-white">Or Download Desktop Shortcut Directly:</span>
                <p className="mt-0.5 text-white/60 text-[0.75rem]">
                  Click the button below to download a 1-click desktop shortcut that will open LifeOS directly anytime from your desktop or taskbar.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Android Tab */}
        {platformTab === "android" && (
          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-[0.8rem]">
            <div className="flex items-start gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-violet-500/20 text-xs font-bold text-violet-300">
                1
              </span>
              <div>
                <span className="font-semibold text-white">Open in Chrome or Samsung Internet:</span>
                <p className="mt-0.5 text-white/60 text-[0.75rem]">
                  Make sure you are viewing this page in Google Chrome or Samsung Internet browser.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-violet-500/20 text-xs font-bold text-violet-300">
                2
              </span>
              <div>
                <span className="font-semibold text-white">Tap the 3-Dots Menu (⋮):</span>
                <p className="mt-0.5 text-white/60 text-[0.75rem]">
                  Tap the <strong className="text-white">⋮</strong> menu in the upper-right corner of Chrome.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-violet-500/20 text-xs font-bold text-violet-300">
                3
              </span>
              <div>
                <span className="font-semibold text-white">Tap &quot;Install app&quot; or &quot;Add to Home screen&quot;:</span>
                <p className="mt-0.5 text-white/60 text-[0.75rem]">
                  LifeOS will install to your app drawer and home screen just like a native app from the Play Store!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* iOS Tab */}
        {platformTab === "ios" && (
          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-[0.8rem]">
            <div className="flex items-start gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-violet-500/20 text-xs font-bold text-violet-300">
                1
              </span>
              <div>
                <span className="font-semibold text-white">Open in Safari:</span>
                <p className="mt-0.5 text-white/60 text-[0.75rem]">
                  On iOS, Apple requires opening the app in <strong className="text-white">Safari</strong> to install.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-violet-500/20 text-xs font-bold text-violet-300">
                2
              </span>
              <div>
                <span className="font-semibold text-white">Tap the Share Button:</span>
                <p className="mt-0.5 text-white/60 text-[0.75rem]">
                  Tap the <Share2 className="inline h-3.5 w-3.5 text-sky-400 mx-1" /> Share button in the bottom toolbar of Safari.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-violet-500/20 text-xs font-bold text-violet-300">
                3
              </span>
              <div>
                <span className="font-semibold text-white">Tap &quot;Add to Home Screen&quot;:</span>
                <p className="mt-0.5 text-white/60 text-[0.75rem]">
                  Scroll down the share sheet, tap <strong className="text-white">&quot;Add to Home Screen&quot;</strong>, then tap <strong className="text-white">&quot;Add&quot;</strong>.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Copy Link Row */}
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5">
          <span className="text-[0.72rem] text-white/50 truncate max-w-[220px] sm:max-w-[300px]">
            {typeof window !== "undefined" ? window.location.origin : "https://your-lifeos-app.vercel.app"}
          </span>
          <button
            onClick={copyLink}
            className="flex items-center gap-1.5 text-[0.72rem] font-semibold text-violet-300 hover:text-violet-200 transition"
          >
            <Copy className="h-3.5 w-3.5" />
            {copied ? "Copied!" : "Copy Link"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Compact Install trigger for Sidebar
 */
export function SidebarInstallButton() {
  const [isStandalone, setIsStandalone] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    setIsStandalone(
      standaloneQuery.matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true,
    );

    const onOpen = () => setModalOpen(true);
    window.addEventListener("lifeos-open-install", onOpen);
    return () => window.removeEventListener("lifeos-open-install", onOpen);
  }, []);

  if (isStandalone) return null;

  async function handleClick() {
    if (window.__pwaInstallPrompt) {
      try {
        await window.__pwaInstallPrompt.prompt();
        const choice = await window.__pwaInstallPrompt.userChoice;
        if (choice.outcome === "accepted") {
          window.dispatchEvent(new CustomEvent("pwa-installed"));
        }
        window.__pwaInstallPrompt = null;
        return;
      } catch {
        // Fall back to modal
      }
    }
    setModalOpen(true);
  }

  return (
    <>
      <button
        onClick={() => void handleClick()}
        className="group flex w-full items-center gap-2.5 rounded-xl border border-violet-500/30 bg-violet-600/15 px-3 py-2 text-[0.78rem] font-medium text-violet-200 transition-all hover:bg-violet-600/25 hover:border-violet-500/50"
      >
        <Download className="h-4 w-4 text-violet-300 transition-transform group-hover:-translate-y-0.5" />
        <span>Install LifeOS App</span>
        <span className="ml-auto rounded-md bg-violet-500/25 px-1.5 py-0.5 text-[0.6rem] font-bold text-violet-300">
          PWA
        </span>
      </button>

      <InstallModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}

/**
 * Rich PWA Install & Download Card for Settings
 */
export function PwaInstallCard() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already running as standalone?
    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const isStandaloneNow =
      standaloneQuery.matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(isStandaloneNow);

    // Pick up globally stashed prompt
    if (window.__pwaInstallPrompt) {
      setDeferredPrompt(window.__pwaInstallPrompt);
    }

    const onPromptReady = () => {
      if (window.__pwaInstallPrompt) {
        setDeferredPrompt(window.__pwaInstallPrompt);
      }
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };
    const onOpen = () => setModalOpen(true);

    window.addEventListener("pwa-prompt-ready", onPromptReady);
    window.addEventListener("pwa-installed", onInstalled);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("lifeos-open-install", onOpen);

    return () => {
      window.removeEventListener("pwa-prompt-ready", onPromptReady);
      window.removeEventListener("pwa-installed", onInstalled);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("lifeos-open-install", onOpen);
    };
  }, []);

  async function handleInstallClick() {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setInstalled(true);
        }
        setDeferredPrompt(null);
        window.__pwaInstallPrompt = null;
        return;
      } catch {
        // Fall back to modal
      }
    }
    setModalOpen(true);
  }

  // If already installed
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
            Running as a standalone native Progressive Web App.
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
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
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-display text-[1rem] font-bold text-white">
                  Install LifeOS App
                </span>
                <span className="rounded-full bg-violet-500/25 border border-violet-400/30 px-2 py-0.5 text-[0.6rem] font-semibold text-violet-200 uppercase tracking-wider">
                  PWA & Desktop
                </span>
              </div>
              <p className="mt-1 text-[0.78rem] text-white/60 leading-relaxed">
                Add LifeOS to your home screen or desktop for fullscreen view, instant offline launch, and native experience.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="grid gap-2.5 sm:grid-cols-2">
            <button
              onClick={() => void handleInstallClick()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-600 px-4 py-3 text-[0.88rem] font-bold text-white shadow-[0_0_24px_rgba(124,92,255,0.5)] transition-all duration-200 hover:scale-[1.01] hover:shadow-[0_0_32px_rgba(124,92,255,0.7)] active:scale-95"
            >
              <Download className="h-4 w-4" />
              {deferredPrompt ? "Install App Now" : "Download & Install App"}
            </button>

            <button
              onClick={downloadDesktopShortcut}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-violet-400/35 bg-white/[0.06] px-4 py-3 text-[0.85rem] font-semibold text-violet-100 transition-all duration-200 hover:bg-white/[0.1] active:scale-95"
            >
              <Laptop className="h-4 w-4 text-violet-300" />
              Download Desktop Launcher (.url)
            </button>
          </div>
        </div>
      </div>

      <InstallModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}

/**
 * Sleek mobile banner that appears at top of screen on mobile devices if PWA is not installed.
 */
export function MobileInstallBanner() {
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const standalone =
      standaloneQuery.matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    const onInstalled = () => setIsStandalone(true);
    window.addEventListener("pwa-installed", onInstalled);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("pwa-installed", onInstalled);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (isStandalone || dismissed) return null;

  async function handleInstall() {
    if (window.__pwaInstallPrompt) {
      try {
        await window.__pwaInstallPrompt.prompt();
        const choice = await window.__pwaInstallPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setIsStandalone(true);
          window.dispatchEvent(new CustomEvent("pwa-installed"));
        }
        window.__pwaInstallPrompt = null;
        return;
      } catch {
        // Fall back to modal
      }
    }
    setModalOpen(true);
  }

  return (
    <>
      <div className="relative mx-3.5 my-2 flex items-center justify-between gap-3 rounded-2xl border border-violet-500/35 bg-[linear-gradient(135deg,rgba(45,20,90,0.85),rgba(15,10,30,0.95))] p-2.5 shadow-[0_6px_24px_rgba(124,92,255,0.3)] backdrop-blur-xl lg:hidden animate-rise">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-white/10 shadow-[0_0_12px_rgba(168,85,247,0.45)]">
            <img
              src="/icons/icon-192.png"
              alt="LifeOS"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-display text-[0.82rem] font-bold text-white truncate">LifeOS App</span>
              <span className="rounded bg-violet-500/30 px-1 py-0.2 text-[0.55rem] font-semibold text-violet-200">
                PWA
              </span>
            </div>
            <p className="text-[0.67rem] text-white/55 truncate">Add to home screen for 1-tap launch</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => void handleInstall()}
            className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 px-3 py-1.5 text-[0.74rem] font-bold text-white shadow-[0_0_12px_rgba(139,92,246,0.5)] active:scale-95 transition"
          >
            <Download className="h-3.5 w-3.5" />
            Install
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="grid h-7 w-7 place-items-center rounded-lg text-white/40 hover:text-white transition"
            aria-label="Dismiss banner"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <InstallModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}

