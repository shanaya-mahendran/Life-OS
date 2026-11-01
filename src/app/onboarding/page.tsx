import { Logo } from "@/components/brand/Logo";
import { DOMAINS } from "@/lib/domains/catalog";
import { requireProfile } from "@/lib/auth";
import { withAlpha } from "@/lib/utils";
import { OnboardingForm } from "./OnboardingForm";

export const metadata = { title: "Set up · LifeOS" };

export default async function OnboardingPage() {
  const { profile } = await requireProfile();

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#06040e] px-5 py-12">
      <div className="aurora-blob left-[-8%] top-[-12%] h-[440px] w-[440px] animate-aurora bg-violet-600/30" />
      <div className="aurora-blob bottom-[-16%] right-[-6%] h-[480px] w-[480px] bg-indigo-600/25" />

      <div className="relative mx-auto w-full max-w-2xl">
        <div className="mb-9 flex flex-col items-center gap-4 text-center">
          <Logo />
          <div className="space-y-2">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-white">
              Let&apos;s set up your week
            </h1>
            <p className="mx-auto max-w-md text-sm leading-relaxed text-white/45">
              LifeOS protects sleep, meals and training by default, then plans everything else around them.
            </p>
          </div>
        </div>

        <div className="surface p-7">
          <OnboardingForm
            defaultName={profile.name ?? ""}
            defaultTimezone={profile.timezone}
          />
        </div>

        <div className="mt-7">
          <p className="mb-3 text-center text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-white/30">
            Your eighteen domains
          </p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {DOMAINS.map((domain) => (
              <span
                key={domain.slug}
                className="rounded-full border px-2.5 py-1 text-[0.66rem] font-medium"
                style={{
                  borderColor: withAlpha(domain.accent, 0.35),
                  backgroundColor: withAlpha(domain.accent, 0.12),
                  color: domain.accent,
                }}
              >
                {domain.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
