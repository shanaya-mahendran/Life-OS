import { ChartColumn } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { buildWeeklyReview, currentWeekStart, proposeNextWeek } from "@/lib/briefs";
import { addZonedDays } from "@/lib/time";
import { PageBanner } from "@/components/shell/PageBanner";
import { ReviewBoard } from "@/components/review/ReviewBoard";

export const metadata = { title: "Weekly Review · LifeOS" };
export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const { user } = await requireProfile();
  const weekStart = currentWeekStart(user.timezone, new Date());

  const [review, proposals] = await Promise.all([
    buildWeeklyReview(user, weekStart),
    proposeNextWeek(user, addZonedDays(weekStart, 7, user.timezone)),
  ]);

  return (
    <div className="space-y-4">
      <PageBanner
        icon={<ChartColumn className="h-5 w-5" />}
        title="Weekly review"
        subtitle={`${review.rangeLabel} · planned versus done, slipped items and next week's plan.`}
        aside={
          <div className="hidden rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right sm:block">
            <p className="font-display text-[0.95rem] font-semibold text-white">{review.adherence}%</p>
            <p className="text-[0.58rem] uppercase tracking-[0.16em] text-white/30">plan completed</p>
          </div>
        }
      />

      <ReviewBoard
        timeZone={user.timezone}
        rangeLabel={review.rangeLabel}
        headline={review.headline}
        adherence={review.adherence}
        done={review.done}
        slipped={review.slipped}
        plannedCount={review.plannedCount}
        focusMinutes={review.focusMinutes}
        previousFocusMinutes={review.previousFocusMinutes}
        perDomain={review.perDomain}
        slippedTasks={review.slippedTasks}
        deadlineTasks={review.deadlineTasks}
        insights={review.insights}
        proposals={proposals}
      />
    </div>
  );
}
