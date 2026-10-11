import { pillVars, tokenVar } from "./word";

/** The book's ribbon tag (unit, lesson, "read and observe"); colour is a token key. */
export function Ribbon({ colour, children }: { colour: string; children: React.ReactNode }) {
  return (
    <span className="nb-ribbon" style={{ background: tokenVar(colour) }}>
      {children}
    </span>
  );
}

export function Tag({ palette, children }: { palette: string; children: React.ReactNode }) {
  return (
    <span className="nb-tag" style={pillVars(palette)}>
      {children}
    </span>
  );
}

/** Progress bar; value 0..1, colour from a pill palette's line. */
export function Meter({ value, palette = "lime", label }: { value: number; palette?: string; label?: string }) {
  const pct = `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`;
  return (
    <div
      className="nb-meter"
      role="progressbar"
      aria-valuenow={Math.round(value * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      style={{ ...pillVars(palette), "--v": pct } as React.CSSProperties}
    >
      <span />
    </div>
  );
}

/** Accuracy ring that draws itself (motion "draw"). */
export function Ring({
  value,
  size = 132,
  label,
  text,
}: {
  value: number;
  size?: number;
  label: string;
  text: string;
}) {
  const r = size / 2 - 10;
  const c = Math.round(2 * Math.PI * r);
  const h = size / 2;
  return (
    <div className="nb-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={h} cy={h} r={r} fill="none" stroke={tokenVar("color.pill.gray.fill")} strokeWidth="14" />
        <circle
          className="nb-anim-draw"
          style={{ "--nb-ring-length": c } as React.CSSProperties}
          cx={h}
          cy={h}
          r={r}
          fill="none"
          stroke={tokenVar("color.green")}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={Math.round(c * (1 - value))}
          transform={`rotate(-90 ${h} ${h})`}
        />
      </svg>
      <span className="nb-ring-text">
        <b style={{ fontSize: Math.round(size / 4.4) }}>{text}</b>
        <span className="nb-muted">{label}</span>
      </span>
    </div>
  );
}

/** Mastery dots: n of total reads right in a row. */
export function Dots({ n, total, label }: { n: number; total: number; label: string }) {
  return (
    <span className="nb-dots" role="img" aria-label={label}>
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i < n ? "on" : undefined} />
      ))}
    </span>
  );
}
