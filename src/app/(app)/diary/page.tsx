import { notFound } from "next/navigation";
import Link from "next/link";
import { BookOpen, Feather, Sparkles, TrendingUp } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { diaryEnabled } from "@/lib/diary/flags";
import {
  diaryStats,
  getDiarySettings,
  getTodayEntry,
  listArtifacts,
  listEntries,
  sparkForToday,
  stampCollection,
} from "@/lib/diary/service";
import { DIARY_ACCENT } from "@/lib/diary/constants";
import { PageBanner } from "@/components/shell/PageBanner";
import { DiaryTabs, DiaryEmpty, StampGrid, StampRow, excerpt, formatDiaryDate } from "@/components/diary/ui";
import { DismissArtifact, NewEntryButton } from "@/components/diary/DiaryActions";
import { gradientStyle } from "@/lib/diary/text";

export const metadata = { title: "Diary · LifeOS" };
export const dynamic = "force-dynamic";

export default async function DiaryHomePage() {
  if (!diaryEnabled()) notFound();

  const { profile, user } = await requireProfile();

  const [settings, today, entries, stamps, stats, trends, blindSpots, seeds, spark] = await Promise.all([
    getDiarySettings(profile.id),
    getTodayEntry(profile.id, user.timezone),
    listEntries(profile.id, 24),
    stampCollection(profile.id),
    diaryStats(profile.id),
    listArtifacts(profile.id, { kind: "trend_card", status: "active", limit: 4 }),
    listArtifacts(profile.id, { kind: "blind_spot", status: "active", limit: 3 }),
    listArtifacts(profile.id, { kind: "pinned_seed", status: "active", limit: 4 }),
    sparkForToday(user),
  ]);

  const recent = entries.filter((entry) => entry.id !== today?.id).slice(0, 8);

  return (
    <div className="space-y-4">
      <PageBanner
        icon={<BookOpen className="h-5 w-5" />}
        title="Diary"
        subtitle="Write freely. A quiet layer colours the page and never talks back unless you ask."
        accent={DIARY_ACCENT}
        aside={stats.total > 0 ? (
          <div className="hidden gap-4 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right sm:flex">
            <div>
              <p className="font-display text-[0.95rem] font-semibold text-white">{stats.daysWritten30}</p>
              <p className="text-[0.55rem] uppercase tracking-[0.14em] text-white/30">days / 30</p>
            </div>
            <div>
              <p className="font-display text-[0.95rem] font-semibold text-white">{stats.total}</p>
              <p className="text-[0.55rem] uppercase tracking-[0.14em] text-white/30">entries</p>
            </div>
          </div>
        ) : undefined}
      />

      <DiaryTabs active="/diary" />

      <div className={`grid gap-3 lg:items-start ${stamps.length > 0 || seeds.length > 0 ? "lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.85fr)]" : "lg:grid-cols-1"}`}>
        <div className="space-y-3">
          {today ? (
            <Link
              href={`/diary/entry/${today.id}`}
              className="block overflow-hidden rounded-3xl border border-white/10 transition hover:border-white/25"
              style={gradientStyle(today.colors)}
            >
              <div className="flex items-center gap-2 border-b border-white/10 bg-black/25 px-4 py-2">
                <span className="text-[0.6rem] font-bold uppercase tracking-[0.16em] text-white/40">Today</span>
                <span className="text-[0.62rem] text-white/25">{formatDiaryDate(today.createdAt)}</span>
                <span className="ml-auto text-[0.62rem] text-white/30">{today.words} words</span>
              </div>
              <div className="p-4 sm:p-5">
                <StampRow stamps={today.stamps} />
                <p className="mt-2.5 line-clamp-6 font-serif text-[0.9rem] leading-[1.7] text-white/75">
                  {today.encrypted ? "This entry is locked. Open it to enter your passphrase." : excerpt(today.body, 320)}
                </p>
                {today.silverLining && !today.silverLiningDeleted && (
                  <p className="mt-2.5 border-l-2 border-amber-300/40 pl-2.5 font-serif text-[0.78rem] italic text-white/50">
                    {today.silverLining}
                  </p>
                )}
                <span className="mt-3 inline-flex items-center gap-1 text-[0.7rem] font-semibold text-amber-200/80">
                  Continue writing →
                </span>
              </div>
            </Link>
          ) : (
            <section className="rounded-3xl border border-white/10 bg-[linear-gradient(150deg,rgba(43,32,16,0.7),rgba(10,7,18,0.96))] p-5">
              <div className="flex items-center gap-2 text-amber-200/80">
                <Sparkles className="h-4 w-4" />
                <p className="text-[0.58rem] font-bold uppercase tracking-[0.16em]">Today&apos;s spark</p>
              </div>
              <p className="mt-2 max-w-lg font-serif text-[1.02rem] leading-relaxed text-white/80">
                {settings.sparkOn && spark
                  ? spark
                  : "The page is blank on purpose. Start with one true sentence and stop whenever you like."}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <NewEntryButton label="Start today's entry" />
                <span className="text-[0.64rem] text-white/30">Autosaves as you type. Nobody else reads it.</span>
              </div>
            </section>
          )}

          <section className="surface p-4">
            <div className="flex items-center gap-2">
              <Feather className="h-3.5 w-3.5 text-amber-200/70" />
              <h2 className="font-display text-[0.92rem] font-semibold text-white">Recent entries</h2>
              {!today && <NewEntryButton label="New" className="btn btn-quiet ml-auto min-h-[34px] text-[0.68rem]" />}
            </div>

            {recent.length === 0 ? (
              <div className="mt-3">
                <DiaryEmpty
                  title="No pages yet"
                  body="Your first entry can be three words. The colours, stamps and silver lining arrive on their own once you finish."
                />
              </div>
            ) : (
              <ul className="mt-2.5 divide-y divide-white/[0.05]">
                {recent.map((entry) => (
                  <li key={entry.id}>
                    <Link href={`/diary/entry/${entry.id}`} className="group flex items-start gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[0.62rem] font-semibold text-white/35">{formatDiaryDate(entry.createdAt)}</span>
                          {entry.tags.slice(0, 2).map((tag) => (
                            <span key={tag} className="text-[0.58rem] text-amber-200/40">
                              #{tag}
                            </span>
                          ))}
                        </div>
                        <p className="mt-0.5 line-clamp-2 font-serif text-[0.8rem] leading-relaxed text-white/60 group-hover:text-white/80">
                          {entry.encrypted ? "🔒 Locked entry" : excerpt(entry.body, 150) || "Empty page — finish it later."}
                        </p>
                      </div>
                      {entry.stamps.length > 0 && <StampRow stamps={entry.stamps} size="sm" />}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {(trends.length > 0 || blindSpots.length > 0) && (
            <section className="surface p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5 text-violet-300" />
                <h2 className="font-display text-[0.92rem] font-semibold text-white">Patterns, maybe</h2>
                <span className="text-[0.6rem] text-white/25">suggestions, never conclusions</span>
              </div>
              <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                {trends.map((card) => (
                  <div
                    key={card.id}
                    className="rounded-2xl border border-violet-400/20 bg-violet-500/[0.07] p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[0.55rem] font-bold uppercase tracking-[0.12em] text-violet-200/70">Trend</p>
                      <DismissArtifact id={card.id} />
                    </div>
                    <p className="mt-1 text-[0.74rem] leading-relaxed text-white/60">{card.body}</p>
                  </div>
                ))}
                {blindSpots.map((card) => (
                  <div key={card.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[0.55rem] font-bold uppercase tracking-[0.12em] text-white/35">Echo</p>
                      <DismissArtifact id={card.id} />
                    </div>
                    <p className="mt-1 line-clamp-4 font-serif text-[0.74rem] italic leading-relaxed text-white/55">
                      “{card.body}”
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {(stamps.length > 0 || seeds.length > 0) && <div className="space-y-3">
          {stamps.length > 0 && (
          <section className="surface p-4">
            <h2 className="font-display text-[0.9rem] font-semibold text-white">Stamp collection</h2>
            <p className="mt-0.5 text-[0.62rem] text-white/30">Your routines, as they accumulated.</p>
            <div className="mt-2.5">
              <StampGrid stamps={stamps} />
            </div>
          </section>
          )}

          {seeds.length > 0 && <section className="surface p-4">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-[0.9rem] font-semibold text-white">Saved ideas</h2>
            </div>
            <ul className="mt-2 space-y-1.5">
              {seeds.map((seed) => (
                <li
                  key={seed.id}
                  className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-2.5 py-2 text-sm leading-relaxed text-white/65"
                >
                  {seed.body}
                </li>
              ))}
            </ul>
          </section>
          }
        </div>}
      </div>
    </div>
  );
}
