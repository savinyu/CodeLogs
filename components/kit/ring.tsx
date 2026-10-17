const STROKE: Record<"primary" | "good" | "foreground", string> = {
  primary: "stroke-primary",
  good: "stroke-good",
  foreground: "stroke-foreground",
};

/** A circular progress ring (Coach's .ring-wrap). `value` is a fraction from 0 to 1. */
export function Ring({
  value,
  size = 40,
  stroke = 5,
  tone = "primary",
  label,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: "primary" | "good" | "foreground";
  label: string;
  children?: React.ReactNode;
}) {
  const v = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  const r = (size - stroke) / 2;
  const c = size / 2;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        <circle cx={c} cy={c} r={r} fill="none" strokeWidth={stroke} className="stroke-muted" />
        {v > 0 ? (
          <circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${v * 100} 100`}
            transform={`rotate(-90 ${c} ${c})`}
            className={STROKE[tone]}
          />
        ) : null}
      </svg>
      {children ? (
        <div className="absolute inset-0 grid place-items-center font-display font-bold">
          {children}
        </div>
      ) : null}
    </div>
  );
}
