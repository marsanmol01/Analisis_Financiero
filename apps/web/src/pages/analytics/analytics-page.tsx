import { useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Spinner } from "../../components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { MonthlyBarsChart } from "../../components/charts/monthly-bars";
import { BarList } from "../../components/charts/bar-list";
import { useAccounts } from "../../hooks/use-accounts";
import { useByCategory, useByMerchant, useMonthlyEvolution, useSummary, useTopExpenses } from "../../hooks/use-analytics";
import { formatCurrency, formatDate, formatPercent } from "../../lib/format";

const ALL_ACCOUNTS = "__all__";

export function AnalyticsPage() {
  const [accountId, setAccountId] = useState(ALL_ACCOUNTS);
  const [month, setMonth] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: accounts } = useAccounts();
  const account = accountId === ALL_ACCOUNTS ? undefined : accountId;

  const { data: summary, isLoading: summaryLoading } = useSummary({ accountId: account, month: month || undefined });
  const { data: monthly, isLoading: monthlyLoading } = useMonthlyEvolution({ accountId: account, months: 12 });
  const { data: byCategory, isLoading: byCategoryLoading } = useByCategory({
    accountId: account,
    from: from || undefined,
    to: to || undefined,
  });
  const { data: byMerchant, isLoading: byMerchantLoading } = useByMerchant({
    accountId: account,
    from: from || undefined,
    to: to || undefined,
  });
  const { data: topExpenses, isLoading: topExpensesLoading } = useTopExpenses({
    accountId: account,
    from: from || undefined,
    to: to || undefined,
    limit: 10,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Estadísticas</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Analiza tus ingresos y gastos con más detalle.</p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div className="flex flex-col gap-1.5">
            <Label>Cuenta</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_ACCOUNTS}>Todas las cuentas</SelectItem>
                {(accounts ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="summary-month">Mes del resumen</Label>
            <Input id="summary-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="range-from">Desglose desde</Label>
            <Input id="range-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="range-to">Desglose hasta</Label>
            <Input id="range-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {summaryLoading && (
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          <Spinner /> Cargando resumen…
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Ingresos" value={formatCurrency(summary.income)} change={summary.previousMonth.incomeChangePercent} />
          <StatCard
            label="Gastos"
            value={formatCurrency(summary.expenses)}
            change={summary.previousMonth.expensesChangePercent}
            invert
          />
          <StatCard label="Ahorro" value={formatCurrency(summary.savings)} />
          <StatCard label="Tasa de ahorro" value={formatPercent(summary.savingsRate)} />
        </div>
      )}

      {summary && (
        <Card>
          <CardContent className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-2">
            <div>
              <CardDescription>Mes anterior ({summary.previousMonth.month})</CardDescription>
              <p className="text-sm text-slate-700">
                Ingresos {formatCurrency(summary.previousMonth.income)} · Gastos{" "}
                {formatCurrency(summary.previousMonth.expenses)}
              </p>
            </div>
            <div>
              <CardDescription>
                Media de los últimos {summary.averageLastMonths.months} meses
              </CardDescription>
              <p className="text-sm text-slate-700">
                Ingresos {formatCurrency(summary.averageLastMonths.income)} · Gastos{" "}
                {formatCurrency(summary.averageLastMonths.expenses)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Evolución mensual (12 meses)</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {monthlyLoading ? (
            <Spinner />
          ) : (
            <MonthlyBarsChart data={monthly ?? []} />
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Gasto por categoría</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {byCategoryLoading ? (
              <Spinner />
            ) : (
              <BarList
                emptyLabel="No hay gastos categorizados en este periodo."
                items={(byCategory ?? []).map((c) => ({
                  key: c.categoryId ?? "none",
                  label: `${c.categoryName ?? "Sin categoría"} (${c.transactionCount})`,
                  value: c.total,
                }))}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gasto por comercio</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {byMerchantLoading ? (
              <Spinner />
            ) : (
              <BarList
                emptyLabel="No hay gastos con comercio asignado en este periodo."
                items={(byMerchant ?? []).map((m) => ({
                  key: m.merchantId ?? "none",
                  label: `${m.merchantName ?? "Sin comercio"} (${m.transactionCount})`,
                  value: m.total,
                }))}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mayores gastos</CardTitle>
        </CardHeader>
        {topExpensesLoading ? (
          <CardContent className="pt-0">
            <Spinner />
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Importe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(topExpenses ?? []).map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="whitespace-nowrap text-[var(--color-text-muted)]">{formatDate(tx.date)}</TableCell>
                  <TableCell>{tx.originalDescription}</TableCell>
                  <TableCell className="whitespace-nowrap text-right font-medium text-[var(--color-negative)]">
                    {formatCurrency(Number(tx.amount))}
                  </TableCell>
                </TableRow>
              ))}
              {(topExpenses ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-[var(--color-text-muted)]">
                    No hay gastos en este periodo.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  change,
  invert,
}: {
  label: string;
  value: string;
  change?: number | null;
  invert?: boolean;
}) {
  const isGood = change === undefined || change === null ? null : invert ? change <= 0 : change >= 0;
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle>
          <span className="text-2xl">{value}</span>
        </CardTitle>
        {change !== undefined && change !== null && (
          <div
            className={`flex items-center gap-1 text-xs ${
              isGood ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]"
            }`}
          >
            {change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(change).toFixed(1)}% vs. mes anterior
          </div>
        )}
      </CardHeader>
    </Card>
  );
}
