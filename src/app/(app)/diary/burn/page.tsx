import { notFound } from "next/navigation";
import { Flame } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { diaryEnabled } from "@/lib/diary/flags";
import { listBurnEntries } from "@/lib/diary/service";
import { PageBanner } from "@/components/shell/PageBanner";
import { DiaryTabs } from "@/components/diary/ui";
import { BurnForm } from "@/components/diary/BurnForm";

export const metadata = { title: "Burn Diary · LifeOS" };
export const dynamic = "force-dynamic";

export default async function BurnDiaryPage() {
  if (!diaryEnabled()) notFound();

  const { profile } = await requireProfile();
  const burns = await listBurnEntries(profile.id, 20);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <PageBanner
        icon={<Flame className="h-5 w-5" />}
        title="Burn Diary"
        subtitle="For the things you need to say once and never see again."
        accent="#fb7185"
      />
      <DiaryTabs active="/diary/burn" />
      <BurnForm burns={burns} />
    </div>
  );
}
