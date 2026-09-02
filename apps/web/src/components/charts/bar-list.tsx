import { formatCurrency } from "../../lib/format";

export interface BarListItem {
  key: string;
  label: string;
  value: number;
}

export function BarList({ items, emptyLabel }: { items: BarListItem[]; emptyLabel: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-[var(--color-text-muted)]">{emptyLabel}</p>;
  }

  const max = Math.max(1, ...items.map((item) => item.value));

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <div key={item.key} className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-sm">
            <span className="truncate text-slate-700">{item.label}</span>
            <span className="whitespace-nowrap font-medium text-slate-900">{formatCurrency(item.value)}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[var(--color-surface-muted)]">
            <div
              className="h-1.5 rounded-full bg-[var(--color-brand-500)]"
              style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
