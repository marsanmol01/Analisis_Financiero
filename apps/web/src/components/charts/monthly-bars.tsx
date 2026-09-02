import { formatCurrency } from "../../lib/format";
import type { MonthlyAmounts } from "../../types/analytics";

const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function shortMonth(monthKey: string): string {
  const [, month] = monthKey.split("-").map(Number);
  return MONTH_LABELS[month - 1] ?? monthKey;
}

export function MonthlyBarsChart({ data }: { data: MonthlyAmounts[] }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.income, d.expenses)));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-[var(--color-positive)]" /> Ingresos
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-[var(--color-negative)]" /> Gastos
        </span>
      </div>
      <div className="flex items-end gap-2 overflow-x-auto pb-1" style={{ minHeight: 160 }}>
        {data.map((month) => (
          <div key={month.month} className="flex min-w-[2.5rem] flex-1 flex-col items-center gap-1">
            <div className="flex h-32 w-full items-end justify-center gap-0.5" title={`${month.month}`}>
              <div
                className="w-1/2 rounded-t-sm bg-[var(--color-positive)]"
                style={{ height: `${Math.max(2, (month.income / max) * 100)}%` }}
                title={formatCurrency(month.income)}
              />
              <div
                className="w-1/2 rounded-t-sm bg-[var(--color-negative)]"
                style={{ height: `${Math.max(2, (month.expenses / max) * 100)}%` }}
                title={formatCurrency(month.expenses)}
              />
            </div>
            <span className="text-[10px] text-[var(--color-text-muted)]">{shortMonth(month.month)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
