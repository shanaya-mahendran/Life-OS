import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireProfile } from "@/lib/auth";
import { diaryEnabled } from "@/lib/diary/flags";
import { getDiarySettings, getEntry, listSessionsForEntry } from "@/lib/diary/service";
import { EntryEditor } from "@/components/diary/EntryEditor";
import { safeJson } from "@/lib/utils";

export const metadata = { title: "Diary entry · LifeOS" };
export const dynamic = "force-dynamic";

export default async function DiaryEntryPage({ params }: { params: Promise<{ id: string }> }) {
  if (!diaryEnabled()) notFound();

  const { profile } = await requireProfile();
  const { id } = await params;

  const entry = await getEntry(profile.id, id);
  if (!entry) notFound();

  const [sessions, settings, pinned] = await Promise.all([
    listSessionsForEntry(profile.id, id),
    getDiarySettings(profile.id),
    prisma.diaryArtifact.findMany({
      where: { userId: profile.id, kind: "pinned_seed", status: "active" },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: { id: true, body: true, sourceIds: true },
    }),
  ]);

  const kept = pinned
    .filter((item) => safeJson<string[]>(item.sourceIds, []).includes(id))
    .map((item) => ({ id: item.id, body: item.body }));

  const aiReady =
    settings.aiEnabled &&
    settings.aiConfigured &&
    settings.sendTextToAi &&
    settings.ambientOn &&
    !(settings.pausedUntil && new Date(settings.pausedUntil) > new Date());

  return (
    <div className="mx-auto w-full max-w-3xl">
      <EntryEditor
        entry={entry}
        sessions={sessions}
        kept={kept}
        encryptionSalt={settings.encryptionSalt}
        aiReady={aiReady}
      />
    </div>
  );
}
