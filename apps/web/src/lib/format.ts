const currencyFormatter = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export function formatPercent(value: number | null): string {
  if (value === null) return "—";
  return `${value.toFixed(1)}%`;
}
