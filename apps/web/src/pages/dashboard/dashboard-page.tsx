import { Link } from "react-router";
import { AlertTriangle, Info, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Spinner } from "../../components/ui/spinner";
import { MonthlyBarsChart } from "../../components/charts/monthly-bars";
import { BarList } from "../../components/charts/bar-list";
import { NetWorthSparkline } from "../../components/charts/net-worth-sparkline";
import { useCurrentUser } from "../../hooks/use-auth";
import { useDashboard } from "../../hooks/use-dashboard";
import { useCategories } from "../../hooks/use-categories";
import { formatCurrency, formatDate, formatPercent } from "../../lib/format";
import type { DashboardAlert } from "../../types/dashboard";

export function DashboardPage() {
  const { data: user } = useCurrentUser();
  const { data, isLoading, isError } = useDashboard();
  const { data: categories } = useCategories();

  const categoriesById = new Map((categories ?? []).map((c) => [c.id, c]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Hola{user ? `, ${user.email}` : ""}</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Resumen de tus finanzas.</p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          <Spinner /> Cargando resumen…
        </div>
      )}

      {isError && (
        <Card>
          <CardContent className="pt-6 text-sm text-[var(--color-negative)]">
            No se pudo cargar el resumen. Inténtalo de nuevo en unos segundos.
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          {data.alerts.length > 0 && (
            <div className="flex flex-col gap-2">
              {data.alerts.map((alert, index) => (
                <AlertBanner key={index} alert={alert} />
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard title="Patrimonio total" value={formatCurrency(data.netWorth.netWorth)} />
            <SummaryCard
              title="Ingresos del mes"
              value={formatCurrency(data.summary.income)}
              tone="positive"
              changePercent={data.summary.previousMonth.incomeChangePercent}
            />
            <SummaryCard
              title="Gastos del mes"
              value={formatCurrency(data.summary.expenses)}
              tone="negative"
              changePercent={data.summary.previousMonth.expensesChangePercent}
              invertChangeTone
            />
            <SummaryCard
              title="Tasa de ahorro"
              value={formatPercent(data.summary.savingsRate)}
              description={`${formatCurrency(data.summary.savings)} ahorrados este mes`}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Dinero realmente disponible</CardTitle>
              <CardDescription>Saldo líquido menos lo que ya está comprometido este mes.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 pt-0 sm:grid-cols-4">
              <MiniStat label="Saldo líquido" value={formatCurrency(data.availableMoney.liquidBalance)} />
              <MiniStat label="Recurrentes pendientes" value={`- ${formatCurrency(data.availableMoney.pendingRecurringPayments)}`} />
              <MiniStat label="Aportación a objetivos" value={`- ${formatCurrency(data.availableMoney.savingsGoalsMonthlyNeeded)}`} />
              <MiniStat
                label="Disponible / día"
                value={
                  data.availableMoney.dailyBudget !== null ? formatCurrency(data.availableMoney.dailyBudget) : "—"
                }
                emphasize
              />
            </CardContent>
            <CardContent className="pt-0">
              <p className="text-lg font-semibold text-slate-900">
                {formatCurrency(data.availableMoney.availableMoney)} disponibles
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Evolución mensual</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <MonthlyBarsChart data={data.monthlyEvolution} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Patrimonio</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <NetWorthSparkline points={data.netWorthEvolution} />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Gasto por categoría (este mes)</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <BarList
                  emptyLabel="Todavía no hay gastos categorizados este mes."
                  items={data.byCategory.slice(0, 6).map((c) => ({
                    key: c.categoryId ?? "none",
                    label: c.categoryName ?? "Sin categoría",
                    value: c.total,
                  }))}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Mayores gastos (este mes)</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 pt-0">
                {data.topExpenses.length === 0 && (
                  <p className="text-sm text-[var(--color-text-muted)]">No hay gastos este mes.</p>
                )}
                {data.topExpenses.slice(0, 6).map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between gap-2 text-sm">
                    <div className="flex flex-col truncate">
                      <span className="truncate text-slate-700">{tx.originalDescription}</span>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {formatDate(tx.date)}
                        {tx.categoryId && ` · ${categoriesById.get(tx.categoryId)?.name ?? ""}`}
                      </span>
                    </div>
                    <span className="whitespace-nowrap font-medium text-[var(--color-negative)]">
                      {formatCurrency(Number(tx.amount))}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Presupuestos</CardTitle>
                  <Link to="/budgets" className="text-sm text-[var(--color-brand-600)] hover:underline">
                    Ver todos
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 pt-0">
                {data.budgetsProgress.length === 0 && (
                  <p className="text-sm text-[var(--color-text-muted)]">No has creado ningún presupuesto todavía.</p>
                )}
                {data.budgetsProgress.slice(0, 4).map((budget) => (
                  <div key={budget.id} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">{budget.categoryName ?? "Presupuesto general"}</span>
                      <span className="text-[var(--color-text-muted)]">
                        {formatCurrency(budget.spent)} / {formatCurrency(budget.amount)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[var(--color-surface-muted)]">
                      <div
                        className={`h-1.5 rounded-full ${
                          budget.alertLevel === 100
                            ? "bg-[var(--color-negative)]"
                            : budget.alertLevel && budget.alertLevel >= 90
                              ? "bg-[var(--color-warning)]"
                              : "bg-[var(--color-brand-500)]"
                        }`}
                        style={{ width: `${Math.min(100, budget.percentageConsumed)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Objetivos de ahorro</CardTitle>
                  <Link to="/savings-goals" className="text-sm text-[var(--color-brand-600)] hover:underline">
                    Ver todos
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 pt-0">
                {data.savingsGoals.length === 0 && (
                  <p className="text-sm text-[var(--color-text-muted)]">No has creado ningún objetivo todavía.</p>
                )}
                {data.savingsGoals.slice(0, 4).map((goal) => (
                  <div key={goal.id} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">{goal.name}</span>
                      <Badge variant={goal.progress.isOnTrack ? "positive" : "warning"}>
                        {goal.progress.isOnTrack ? "En marcha" : "Retrasado"}
                      </Badge>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[var(--color-surface-muted)]">
                      <div
                        className="h-1.5 rounded-full bg-[var(--color-brand-500)]"
                        style={{ width: `${Math.min(100, Math.max(0, goal.progress.progressPercent))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function AlertBanner({ alert }: { alert: DashboardAlert }) {
  const styles: Record<DashboardAlert["severity"], string> = {
    critical: "border-[var(--color-negative)]/20 bg-[var(--color-negative-muted)] text-[var(--color-negative)]",
    warning: "border-[var(--color-warning)]/20 bg-[var(--color-warning-muted)] text-[var(--color-warning)]",
    info: "border-[var(--color-brand-500)]/20 bg-[var(--color-brand-50)] text-[var(--color-brand-700)]",
  };
  const Icon = alert.severity === "critical" ? AlertTriangle : alert.severity === "warning" ? AlertTriangle : Info;

  return (
    <div className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${styles[alert.severity]}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      {alert.message}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  description,
  tone,
  changePercent,
  invertChangeTone,
}: {
  title: string;
  value: string;
  description?: string;
  tone?: "positive" | "negative";
  changePercent?: number | null;
  invertChangeTone?: boolean;
}) {
  const changeIsGood =
    changePercent === undefined || changePercent === null
      ? null
      : invertChangeTone
        ? changePercent <= 0
        : changePercent >= 0;

  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle
          className={
            tone === "positive"
              ? "text-[var(--color-positive)]"
              : tone === "negative"
                ? "text-[var(--color-negative)]"
                : undefined
          }
        >
          <span className="text-2xl">{value}</span>
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {changePercent !== undefined && changePercent !== null && (
          <div
            className={`flex items-center gap-1 text-xs ${
              changeIsGood ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]"
            }`}
          >
            {changePercent >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(changePercent).toFixed(1)}% vs. mes anterior
          </div>
        )}
      </CardHeader>
    </Card>
  );
}

function MiniStat({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-[var(--color-text-muted)]">{label}</span>
      <span className={emphasize ? "text-base font-semibold text-slate-900" : "text-sm text-slate-700"}>{value}</span>
    </div>
  );
}
