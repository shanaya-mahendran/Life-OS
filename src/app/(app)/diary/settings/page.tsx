import { notFound } from "next/navigation";
import { Settings2 } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { diaryEnabled } from "@/lib/diary/flags";
import { getDiarySettings } from "@/lib/diary/service";
import { DIARY_ACCENT } from "@/lib/diary/constants";
import { PageBanner } from "@/components/shell/PageBanner";
import { DiaryTabs } from "@/components/diary/ui";
import { DiarySettingsForm } from "@/components/diary/DiarySettingsForm";

export const metadata = { title: "Diary settings · LifeOS" };
export const dynamic = "force-dynamic";

export default async function DiarySettingsPage() {
  if (!diaryEnabled()) notFound();

  const { profile } = await requireProfile();
  const settings = await getDiarySettings(profile.id);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <PageBanner
        icon={<Settings2 className="h-5 w-5" />}
        title="Diary settings"
        subtitle="Every AI feature has an off switch. The diary itself always works."
        accent={DIARY_ACCENT}
      />
      <DiaryTabs active="/diary/settings" />
      <DiarySettingsForm settings={settings} />
    </div>
  );
}
