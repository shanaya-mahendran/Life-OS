import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireProfile } from "@/lib/auth";
import { diaryEnabled } from "@/lib/diary/flags";
import { getSession } from "@/lib/diary/service";
import { SessionView } from "@/components/diary/SessionView";

export const metadata = { title: "Diary session · LifeOS" };
export const dynamic = "force-dynamic";

export default async function DiarySessionPage({ params }: { params: Promise<{ id: string }> }) {
  if (!diaryEnabled()) notFound();

  const { profile } = await requireProfile();
  const { id } = await params;

  const session = await getSession(profile.id, id);
  if (!session) notFound();

  const entry = await prisma.diaryEntry.findFirst({
    where: { id: session.entryId, userId: profile.id },
    select: { entryDate: true },
  });

  return (
    <div className="mx-auto w-full max-w-2xl">
      <SessionView session={session} entryDate={entry?.entryDate ?? ""} />
    </div>
  );
}
