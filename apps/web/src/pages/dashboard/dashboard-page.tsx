import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Spinner } from "../../components/ui/spinner";
import { useCurrentUser } from "../../hooks/use-auth";
import { useDashboard } from "../../hooks/use-dashboard";
import { formatCurrency, formatPercent } from "../../lib/format";

// Version minima del dashboard: confirma que sesion, cliente API y datos reales funcionan de
// extremo a extremo. El contenido completo (graficas, presupuestos, alertas...) llega en el
// ultimo bloque del frontend, cuando el resto de secciones ya esten construidas.
export function DashboardPage() {
  const { data: user } = useCurrentUser();
  const { data, isLoading, isError } = useDashboard();

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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Patrimonio total" value={formatCurrency(data.netWorth.netWorth)} />
          <SummaryCard title="Ingresos del mes" value={formatCurrency(data.summary.income)} tone="positive" />
          <SummaryCard title="Gastos del mes" value={formatCurrency(data.summary.expenses)} tone="negative" />
          <SummaryCard
            title="Tasa de ahorro"
            value={formatPercent(data.summary.savingsRate)}
            description={`${formatCurrency(data.summary.savings)} ahorrados este mes`}
          />
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  description,
  tone,
}: {
  title: string;
  value: string;
  description?: string;
  tone?: "positive" | "negative";
}) {
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
      </CardHeader>
    </Card>
  );
}
