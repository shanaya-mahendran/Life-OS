import { cn } from "@/lib/utils";

export function LogoMark({ className, size = 36 }: { className?: string; size?: number }) {
  return (
    <span
      className={cn(
        "relative grid place-items-center rounded-[0.85rem] bg-gradient-to-br from-violet-400 via-violet-600 to-indigo-700",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span className="absolute inset-0 rounded-[0.85rem] bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.55),transparent_55%)]" />
      <svg viewBox="0 0 24 24" width={size * 0.58} height={size * 0.58} fill="none" className="relative">
        <path
          d="M12 3.2c1.6 3.3 2.7 4.4 6 6-3.3 1.6-4.4 2.7-6 6-1.6-3.3-2.7-4.4-6-6 3.3-1.6 4.4-2.7 6-6Z"
          fill="white"
          fillOpacity="0.95"
        />
        <circle cx="18.4" cy="17.6" r="2" fill="white" fillOpacity="0.7" />
      </svg>
    </span>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      {!compact && (
        <div className="leading-none">
          <div className="font-display text-[1.28rem] font-semibold tracking-tight text-white">
            Life<span className="text-violet-300">OS</span>
          </div>
          <div className="mt-1 text-[0.6rem] font-medium uppercase tracking-[0.22em] text-white/40">
            Plan · Achieve · Thrive
          </div>
        </div>
      )}
    </div>
  );
}
