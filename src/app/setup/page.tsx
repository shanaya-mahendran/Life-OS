import { LogoMark } from "@/components/brand/Logo";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata = { title: "Setup · LifeOS" };

const VARS = [
  {
    key: "NEXT_PUBLIC_SUPABASE_URL",
    hint: "Supabase → Project Settings → API → Project URL",
  },
  {
    key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    hint: "Supabase → Project Settings → API → anon public key",
  },
  {
    key: "DATABASE_URL",
    hint: "Connection pooling string (port 6543) + ?pgbouncer=true",
  },
  {
    key: "DIRECT_URL",
    hint: "Direct connection string (port 5432) used for migrations",
  },
  {
    key: "DEEPSEEK_API_KEY",
    hint: "platform.deepseek.com → API keys (server-side only)",
  },
];

export default function SetupPage() {
  const rows = VARS.map((variable) => ({
    ...variable,
    present: Boolean(process.env[variable.key]),
  }));

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-[#06040e] px-5 py-12">
      <div className="aurora-blob left-[10%] top-[-10%] h-[420px] w-[420px] bg-violet-600/30" />
      <div className="aurora-blob bottom-[-15%] right-[5%] h-[460px] w-[460px] bg-indigo-600/25" />

      <div className="surface relative w-full max-w-xl p-8">
        <div className="mb-6 flex items-center gap-3">
          <LogoMark size={40} />
          <div>
            <h1 className="font-display text-xl font-semibold text-white">Connect your services</h1>
            <p className="text-xs text-white/45">
              {isSupabaseConfigured
                ? "Supabase is connected. Remaining items are optional."
                : "Add these values to .env, then restart the dev server."}
            </p>
          </div>
        </div>

        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.key}
              className="flex items-start justify-between gap-4 rounded-xl border border-white/5 bg-white/[0.03] px-3.5 py-3"
            >
              <div>
                <div className="font-mono text-[0.72rem] text-white/80">{row.key}</div>
                <div className="mt-0.5 text-[0.68rem] text-white/35">{row.hint}</div>
              </div>
              <span
                className={`chip shrink-0 ${
                  row.present
                    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                    : "border-amber-400/25 bg-amber-400/10 text-amber-200"
                }`}
              >
                {row.present ? "set" : "missing"}
              </span>
            </li>
          ))}
        </ul>

        <pre className="mt-6 overflow-x-auto rounded-xl border border-white/5 bg-black/40 p-3.5 font-mono text-[0.68rem] leading-relaxed text-white/55">
{`npm install
npx prisma db push     # create tables in Supabase
npm run db:seed        # optional demo account
npm run dev`}
        </pre>

        <p className="mt-5 text-[0.72rem] leading-relaxed text-white/35">
          Secrets never reach the browser: only the two <span className="font-mono">NEXT_PUBLIC_</span> Supabase
          values are exposed, and the DeepSeek key is read exclusively inside server route handlers.
        </p>
      </div>
    </main>
  );
}
