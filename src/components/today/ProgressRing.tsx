import { withAlpha } from "@/lib/utils";

interface ProgressRingProps {
  value: number;
  size?: number;
  stroke?: number;
  accent?: string;
  label?: string;
  caption?: string;
}

export function ProgressRing({
  value,
  size = 112,
  stroke = 9,
  accent = "#8b5cf6",
  label,
  caption,
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const gradientId = `ring-${accent.replace("#", "")}`;

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={accent} />
            <stop offset="100%" stopColor={withAlpha(accent, 0.45)} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-display text-[1.5rem] font-semibold leading-none text-white">{clamped}%</div>
          {label && <div className="mt-1 text-[0.6rem] uppercase tracking-[0.14em] text-white/40">{label}</div>}
          {caption && <div className="mt-0.5 text-[0.62rem] text-white/45">{caption}</div>}
        </div>
      </div>
    </div>
  );
}
