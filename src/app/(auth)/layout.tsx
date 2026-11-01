import { Logo } from "@/components/brand/Logo";

const HIGHLIGHTS = [
  { title: "One master calendar", body: "Eighteen domains, colour-coded, in a single timeline." },
  { title: "Chat that moves events", body: "“Move karate to 7 PM” — checked, logged and undoable." },
  { title: "Protected time", body: "Sleep, meals and training stay untouchable without a confirm." },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#06040e]">
      <div className="aurora-blob left-[-12%] top-[-18%] h-[520px] w-[520px] animate-aurora bg-violet-600/35" />
      <div className="aurora-blob bottom-[-22%] right-[-10%] h-[560px] w-[560px] animate-aurora bg-indigo-600/25" />
      <div className="aurora-blob left-[38%] top-[35%] h-[380px] w-[380px] bg-fuchsia-600/10" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.16) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse at 50% 30%, black, transparent 72%)",
        }}
      />

      <div className="relative mx-auto grid min-h-dvh w-full max-w-6xl items-center gap-12 px-6 py-12 lg:grid-cols-[1.02fr_0.98fr]">
        <aside className="hidden flex-col gap-10 lg:flex">
          <Logo />

          <div className="space-y-5">
            <h1 className="font-display text-[2.9rem] font-semibold leading-[1.05] tracking-[-0.03em] text-white">
              Your whole life,
              <br />
              <span className="bg-gradient-to-r from-violet-300 via-fuchsia-200 to-cyan-200 bg-clip-text text-transparent">
                on one calendar.
              </span>
            </h1>
            <p className="max-w-md text-[0.95rem] leading-relaxed text-white/55">
              Career, exams, hackathons, karate, sleep, finances and everything in between — planned by an agent
              that checks every conflict before it writes.
            </p>
          </div>

          <ul className="space-y-3">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title} className="surface flex items-start gap-3 p-3.5">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400 shadow-[0_0_12px_2px_rgba(167,139,250,0.8)]" />
                <div>
                  <div className="text-sm font-semibold text-white/90">{item.title}</div>
                  <div className="text-xs text-white/45">{item.body}</div>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        <main className="w-full">
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo />
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
