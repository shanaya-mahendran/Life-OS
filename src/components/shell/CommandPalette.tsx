"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search, Sparkles } from "lucide-react";
import { NAV_ITEMS } from "./nav";
import { DOMAIN_MAP } from "@/lib/domains/catalog";
import { withAlpha } from "@/lib/utils";
import { domainFamilyColor } from "@/lib/domains/presentation";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      const timer = setTimeout(() => inputRef.current?.focus(), 40);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const pages = NAV_ITEMS.filter((item) => !needle || item.label.toLowerCase().includes(needle)).map(
      (item) => ({ kind: "page" as const, href: item.href, label: item.label, accent: "#7c5cff" }),
    );
    const domains = Object.values(DOMAIN_MAP)
      .filter((domain) => !needle || domain.name.toLowerCase().includes(needle))
      .map((domain) => ({
        kind: "domain" as const,
        href: `/domains/${domain.slug}`,
        label: domain.name,
        accent: domainFamilyColor(domain.slug, domain.accent),
      }));

    return [...pages, ...domains].slice(0, 7);
  }, [query]);

  const askHref = `/chat?q=${encodeURIComponent(query.trim())}`;

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setIndex((current) => Math.min(results.length, current + 1));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setIndex((current) => Math.max(0, current - 1));
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const target = index === results.length ? askHref : results[index]?.href;
        if (target) {
          router.push(target);
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, results, index, askHref, onClose, router]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]">
      <button className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-label="Close search" />
      <div className="surface relative w-full max-w-xl overflow-hidden p-2">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <Search className="h-4 w-4 text-white/35" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setIndex(0);
            }}
            placeholder="Search pages, domains, or ask LifeOS…"
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
          />
          <kbd className="rounded-md border border-white/10 px-1.5 py-0.5 text-[0.6rem] text-white/35">ESC</kbd>
        </div>

        <div className="max-h-[46vh] overflow-y-auto border-t border-white/5 pt-2">
          {results.map((result, position) => (
            <button
              key={`${result.kind}-${result.href}`}
              onMouseEnter={() => setIndex(position)}
              onClick={() => {
                router.push(result.href);
                onClose();
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[0.82rem] transition ${
                index === position ? "bg-white/[0.08] text-white" : "text-white/60"
              }`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: result.accent, boxShadow: `0 0 8px ${withAlpha(result.accent, 0.6)}` }}
              />
              <span className="flex-1 truncate">{result.label}</span>
              <span className="text-[0.62rem] uppercase tracking-wider text-white/25">{result.kind}</span>
            </button>
          ))}

          {query.trim() && (
            <button
              onMouseEnter={() => setIndex(results.length)}
              onClick={() => {
                router.push(askHref);
                onClose();
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[0.82rem] transition ${
                index === results.length ? "bg-violet-500/15 text-white" : "text-white/60"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-violet-300" />
              <span className="flex-1 truncate">
                Ask LifeOS: <span className="text-white/80">{query.trim()}</span>
              </span>
              <CornerDownLeft className="h-3.5 w-3.5 text-white/30" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
