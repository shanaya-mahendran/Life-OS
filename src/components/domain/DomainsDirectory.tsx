"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Search, Pin, PinOff, Lock, ShieldAlert, Sparkles } from "lucide-react";
import { DomainIcon } from "@/components/domain/DomainIcon";
import { DOMAIN_FAMILIES, domainFamilyColor } from "@/lib/domains/presentation";
import { humanizeMinutes } from "@/lib/time";
import { DOMAIN_MAP, type DomainSlug } from "@/lib/domains/catalog";

export interface DomainItem {
  id: string;
  slug: string;
  name: string;
  accent: string;
  icon: string;
  isProtected: boolean;
  tasksDone: number;
  tasksTotal: number;
  minutes: number;
}

interface DomainsDirectoryProps {
  domains: DomainItem[];
}

export function DomainsDirectory({ domains }: DomainsDirectoryProps) {
  const [query, setQuery] = useState("");
  const [pinned, setPinned] = useState<string[]>([]);

  // Load pinned favorites from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("lifeos_pinned_domains");
      if (stored) {
        setPinned(JSON.parse(stored));
      } else {
        // Default favorites: Education, Sleep, Karate, Prayer
        setPinned(["education", "sleep", "karate", "prayer"]);
      }
    } catch {
      // ignore
    }
  }, []);

  function togglePin(slug: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = pinned.includes(slug) ? pinned.filter((s) => s !== slug) : [...pinned, slug];
    setPinned(next);
    try {
      localStorage.setItem("lifeos_pinned_domains", JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  const domainBySlug = useMemo(() => new Map(domains.map((d) => [d.slug, d])), [domains]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return domains;
    return domains.filter((d) => {
      const config = DOMAIN_MAP[d.slug];
      const matchName = d.name.toLowerCase().includes(q);
      const matchSlug = d.slug.toLowerCase().includes(q);
      const matchTagline = config?.tagline.toLowerCase().includes(q);
      const matchUnique = config?.uniqueSystem?.name.toLowerCase().includes(q);
      return matchName || matchSlug || matchTagline || matchUnique;
    });
  }, [domains, query]);

  const pinnedDomains = useMemo(() => {
    return pinned.map((s) => domainBySlug.get(s)).filter((d): d is DomainItem => Boolean(d));
  }, [pinned, domainBySlug]);

  return (
    <div className="space-y-5">
      {/* Search Bar */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search 22 domains by name, unique system, or goal..."
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-4 text-sm text-white placeholder-white/35 transition focus:border-brand-focus focus:bg-white/[0.07] focus:outline-none"
        />
      </div>

      {/* Pinned Favorites (Quick 1-tap jump) */}
      {!query && pinnedDomains.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/50">
            <Sparkles className="h-3.5 w-3.5 text-brand-hover" />
            <span>Pinned Favorites</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {pinnedDomains.map((domain) => {
              const config = DOMAIN_MAP[domain.slug];
              const color = config?.accent || domainFamilyColor(domain.slug, domain.accent);
              return (
                <Link
                  key={domain.slug}
                  href={`/domains/${domain.slug}`}
                  className="group relative flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 transition hover:border-white/20 hover:bg-white/[0.06]"
                  style={{ borderLeftColor: color, borderLeftWidth: 3 }}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-white">
                    <DomainIcon name={domain.icon} size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-white/90 group-hover:text-white">
                      {domain.name}
                    </div>
                    <div className="text-[0.68rem] text-white/40">
                      {domain.tasksTotal > 0 ? `${domain.tasksDone}/${domain.tasksTotal} done` : config?.uniqueSystem?.name || "Active"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => togglePin(domain.slug, e)}
                    className="opacity-0 transition group-hover:opacity-100 hover:text-white text-white/40"
                    title="Unpin"
                  >
                    <PinOff className="h-3.5 w-3.5" />
                  </button>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* 5 Clusters */}
      <div className="space-y-4">
        {DOMAIN_FAMILIES.map((family) => {
          const familySlugs: readonly string[] = family.slugs;
          const familyDomains = filtered.filter((domain) => familySlugs.includes(domain.slug));
          if (familyDomains.length === 0) return null;

          return (
            <section key={family.name} className="surface overflow-hidden rounded-2xl border border-white/10 p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white/85">{family.name}</h2>
                  <span className="text-[0.72rem] text-white/45">{familyDomains.length} domains</span>
                </div>
              </div>

              <ul className="divide-y divide-white/[0.07]">
                {familyDomains.map((domain) => {
                  const config = DOMAIN_MAP[domain.slug];
                  const color = config?.accent || domainFamilyColor(domain.slug, domain.accent);
                  const isPinned = pinned.includes(domain.slug);
                  const isTier1 = config?.tier === 1;

                  return (
                    <li key={domain.id}>
                      <Link
                        href={`/domains/${domain.slug}`}
                        className="group flex min-h-12 items-center gap-3 py-2.5 transition hover:bg-white/[0.025]"
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.04] text-white/70">
                          <DomainIcon name={domain.icon} size={16} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-white/90 group-hover:text-white">
                              {domain.name}
                            </span>
                            {isTier1 && (
                              <span
                                className="flex items-center gap-0.5 rounded-full border border-rose-400/30 bg-rose-500/10 px-1.5 py-0.2 text-[0.58rem] font-semibold uppercase tracking-wider text-rose-200"
                                title="Tier 1 Fixed Anchor (Medicine, Prayer, Sleep)"
                              >
                                <Lock className="h-2.5 w-2.5" /> Tier 1
                              </span>
                            )}
                            {config?.tier === 2 && (
                              <span
                                className="flex items-center gap-0.5 rounded-full border border-amber-300/30 bg-amber-400/10 px-1.5 py-0.2 text-[0.58rem] font-semibold uppercase tracking-wider text-amber-200"
                                title="Tier 2 Protected Time (Meals, Karate, Rest)"
                              >
                                <ShieldAlert className="h-2.5 w-2.5" /> Protected
                              </span>
                            )}
                          </div>
                          <div className="truncate text-[0.72rem] text-white/40">
                            {config?.uniqueSystem ? `${config.uniqueSystem.name} · ${config.uniqueSystem.tagline}` : config?.tagline}
                          </div>
                        </div>

                        {domain.tasksTotal > 0 && (
                          <span className="hidden text-xs tabular-nums text-white/60 sm:inline">
                            {domain.tasksDone}/{domain.tasksTotal} tasks
                          </span>
                        )}
                        {domain.minutes > 0 && (
                          <span className="text-xs tabular-nums text-white/50">
                            {humanizeMinutes(domain.minutes)}
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={(e) => togglePin(domain.slug, e)}
                          className={`p-1 transition ${
                            isPinned ? "text-brand-text opacity-100" : "text-white/25 opacity-0 group-hover:opacity-100"
                          } hover:text-white`}
                          title={isPinned ? "Unpin domain" : "Pin domain to top"}
                        >
                          <Pin className="h-3.5 w-3.5" />
                        </button>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
