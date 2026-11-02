import { notFound } from "next/navigation";
import { BookOpen } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { diaryEnabled } from "@/lib/diary/flags";
import { listArtifacts } from "@/lib/diary/service";
import { DIARY_ACCENT } from "@/lib/diary/constants";
import { PageBanner } from "@/components/shell/PageBanner";
import { DiaryEmpty, DiaryTabs } from "@/components/diary/ui";
import { DeleteArtifact } from "@/components/diary/DiaryActions";

export const metadata = { title: "Diary stories · LifeOS" };
export const dynamic = "force-dynamic";

export default async function DiaryStoriesPage() {
  if (!diaryEnabled()) notFound();

  const { profile } = await requireProfile();
  const stories = await listArtifacts(profile.id, { kind: "monthly_story", status: "active", limit: 12 });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <PageBanner
        icon={<BookOpen className="h-5 w-5" />}
        title="Monthly stories"
        subtitle="Last month, retold as a short fable. Clearly fictionalised, always separate from the raw pages."
        accent={DIARY_ACCENT}
      />
      <DiaryTabs active="/diary/stories" />

      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-2.5">
        <p className="text-[0.68rem] leading-relaxed text-white/40">
          One story is drafted on the first of each month from the previous month&apos;s entries. Names, places and details stay
          general on purpose. Your entries are untouched — deleting a story never deletes a page.
        </p>
      </div>

      {stories.length === 0 ? (
        <DiaryEmpty
          title="No story yet"
          body="A story appears after a month with at least three entries. Until then, the pages are the point."
        />
      ) : (
        <div className="space-y-2.5">
          {stories.map((story) => (
            <article key={story.id} className="surface p-4">
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-2 py-0.5 text-[0.58rem] font-bold uppercase tracking-[0.12em] text-amber-200/80">
                  {story.periodKey || "story"}
                </span>
                <span className="text-[0.6rem] text-white/25">
                  {new Date(story.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                </span>
                <div className="ml-auto">
                  <DeleteArtifact id={story.id} redirectTo="/diary/stories" />
                </div>
              </div>
              <div className="mt-2 space-y-2 font-serif text-[0.85rem] leading-[1.75] text-white/70">
                {story.body.split(/\n{2,}/).map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
