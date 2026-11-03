import Link from "next/link";
import { ChartColumn } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { buildWeeklyReview, currentWeekStart, proposeNextWeek } from "@/lib/briefs";
import { addZonedDays, startOfWeekMonday, utcToZoned, zonedToUtc } from "@/lib/time";
import { PageBanner } from "@/components/shell/PageBanner";
import { ReviewBoard } from "@/components/review/ReviewBoard";

export const metadata = { title: "Weekly Review · LifeOS" };
export const dynamic = "force-dynamic";

function dateKey(date: Date, timeZone: string): string {
  const local = utcToZoned(date, timeZone);
  return `${local.year}-${String(local.month).padStart(2, "0")}-${String(local.day).padStart(2, "0")}`;
}

function requestedWeekStart(value: string | undefined, timeZone: string, currentWeek: Date): Date {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return currentWeek;
  const [year, month, day] = value.split("-").map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) {
    return currentWeek;
  }
  const selected = startOfWeekMonday(zonedToUtc({ year, month, day }, timeZone), timeZone);
  return selected > currentWeek ? currentWeek : selected;
}

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string | string[] }>;
}) {
  const { user } = await requireProfile();
  const now = new Date();
  const thisWeek = currentWeekStart(user.timezone, now);
  const { week } = await searchParams;
  const weekStart = requestedWeekStart(typeof week === "string" ? week : undefined, user.timezone, thisWeek);
  const isCurrentWeek = weekStart.getTime() === thisWeek.getTime();
  const previousWeek = addZonedDays(weekStart, -7, user.timezone);
  const nextWeek = addZonedDays(weekStart, 7, user.timezone);
  const weekKey = dateKey(weekStart, user.timezone);
  const canGoForward = nextWeek <= thisWeek;

  const [review, proposals] = await Promise.all([
    buildWeeklyReview(user, weekStart, isCurrentWeek),
    isCurrentWeek ? proposeNextWeek(user, addZonedDays(weekStart, 7, user.timezone)) : Promise.resolve([]),
  ]);

  return (
    <div className="min-w-0 space-y-4">
      <PageBanner
        icon={<ChartColumn className="h-5 w-5" />}
        title="Weekly review"
        subtitle={`${review.rangeLabel} · ${isCurrentWeek ? "This week's activity and next week's plan." : "Historical activity compared with the week before."}`}
        aside={
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
            <Link
              href={`/review?week=${dateKey(previousWeek, user.timezone)}`}
              className="btn btn-ghost min-h-10 px-3"
              aria-label="View previous week"
            >
              Previous
            </Link>
            <form action="/review" method="GET" className="flex min-w-0 flex-1 items-center gap-2 sm:flex-initial">
              <input
                type="date"
                name="week"
                value={weekKey}
                max={dateKey(thisWeek, user.timezone)}
                aria-label="Choose a week to review"
                className="field min-w-0 max-w-full flex-1 px-2 py-2 text-sm sm:w-40 sm:flex-initial"
              />
              <button type="submit" className="btn btn-primary min-h-10 shrink-0 px-3">
                View
              </button>
            </form>
            {canGoForward ? (
              <Link
                href={`/review?week=${dateKey(nextWeek, user.timezone)}`}
                className="btn btn-ghost min-h-10 px-3"
                aria-label="View next week"
              >
                Next
              </Link>
            ) : (
              <span className="btn btn-ghost min-h-10 cursor-not-allowed px-3 opacity-40" aria-disabled="true">
                Next
              </span>
            )}
          </div>
        }
      />

      <ReviewBoard
        key={weekKey}
        timeZone={user.timezone}
        isCurrentWeek={isCurrentWeek}
        rangeLabel={review.rangeLabel}
        headline={review.headline}
        adherence={review.adherence}
        done={review.done}
        slipped={review.slipped}
        eventAchieved={review.eventAchieved}
        eventResolved={review.eventResolved}
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
