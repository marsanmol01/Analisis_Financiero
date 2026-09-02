import type { NetWorthEvolutionPoint } from "../../types/analytics";
import { formatCurrency } from "../../lib/format";

const WIDTH = 600;
const HEIGHT = 120;
const PADDING = 8;

export function NetWorthSparkline({ points }: { points: NetWorthEvolutionPoint[] }) {
  if (points.length < 2) {
    return <p className="text-sm text-[var(--color-text-muted)]">Aún no hay histórico suficiente.</p>;
  }

  const values = points.map((p) => p.netWorth);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const step = (WIDTH - PADDING * 2) / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = PADDING + i * step;
    const y = PADDING + (1 - (p.netWorth - min) / range) * (HEIGHT - PADDING * 2);
    return { x, y };
  });

  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const first = points[0];
  const last = points[points.length - 1];

  return (
    <div className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" preserveAspectRatio="none" role="img">
        <path d={path} fill="none" stroke="var(--color-brand-500)" strokeWidth={2} />
        {coords.map((c, i) => (
          <circle key={points[i].month} cx={c.x} cy={c.y} r={2.5} fill="var(--color-brand-600)" />
        ))}
      </svg>
      <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
        <span>
          {first.month}: {formatCurrency(first.netWorth)}
        </span>
        <span>
          {last.month}: {formatCurrency(last.netWorth)}
        </span>
      </div>
    </div>
  );
}
