# Dashboard (Fase 3, bloque 4 — cierre de fase)

`GET /dashboard` es un único endpoint de solo lectura que compone lo ya construido en los bloques anteriores de Fase 3 (nunca duplica su lógica) más dos cálculos nuevos.

## Composición

| Campo | Origen |
|---|---|
| `summary` | `AnalyticsService.getSummary` — mes actual, comparativa con el anterior y con la media |
| `netWorth` | `AnalyticsService.getNetWorth` — patrimonio actual |
| `netWorthEvolution` | `AnalyticsService.getNetWorthEvolution` — **nuevo**, ver abajo |
| `monthlyEvolution` | `AnalyticsService.getMonthlyEvolution` |
| `byCategory` | `AnalyticsService.getByCategory` (mes actual) |
| `topExpenses` | `AnalyticsService.getTopExpenses` (top 5 del mes) |
| `budgetsProgress` | `BudgetsService.getProgress` |
| `savingsGoals` | `SavingsGoalsService.findAll` |
| `recurringGroups` | `RecurringService.findAll` (activos) |
| `availableMoney` | **nuevo**, ver abajo |
| `alerts` | **nuevo**, sintetizado a partir de lo anterior |

## Evolución del patrimonio: `BalanceSnapshot`

Sin un histórico real de saldos no hay forma honesta de mostrar una evolución del patrimonio — así que se añade `BalanceSnapshot`, capturado **automáticamente** por `AccountsService`:
- Al crear una cuenta: una foto inicial con el saldo de alta.
- Al editar una cuenta: una foto nueva **solo si el campo `balance` cambia** (editar el nombre, la entidad, etc. no genera una foto — evitaría llenar el histórico de puntos idénticos sin información nueva).

`AnalyticsService.getNetWorthEvolution(userId, months)` reconstruye el patrimonio de cada mes tomando, para cada cuenta, la última foto anterior al fin de ese mes. Si una cuenta todavía no existía (no tiene ninguna foto previa), su aportación a ese mes es 0 — **no se inventa un valor hacia atrás**. Para un usuario recién creado, o antes de que exista alguna cuenta, todos los meses solicitados salen a 0€; según se van creando/editando cuentas, el histórico empieza a poblarse desde ese momento en adelante.

## Dinero realmente disponible

```
Saldo líquido disponible
− Pagos recurrentes pendientes este mes
− Aportación mensual necesaria a objetivos activos
= Dinero realmente disponible
```

- **Saldo líquido**: suma de `Account.balance` de las cuentas de tipo `CHECKING`, `SAVINGS`, `CASH`, `DIGITAL` y `CARD`. Se excluyen deliberadamente `INVESTMENT` y `DEPOSIT` (no son dinero de uso inmediato — suelen tener plazo o penalización por retirada anticipada) y `LOAN` (es deuda, no disponible). Decisión explícita, documentada también en `analytics.service.ts`.
- **Pagos recurrentes pendientes**: suma de `typicalAmount` (en valor absoluto) de los grupos recurrentes activos cuya `nextEstimatedDate` cae entre hoy y el fin del mes actual — lo que previsiblemente se va a cobrar antes de que acabe el mes y todavía no ha ocurrido.
- **Aportación necesaria a objetivos**: suma de `monthlyContributionNeeded` (ver `docs/savings-goals.md`) de los objetivos con `status: ACTIVE`.

**Presupuesto disponible por día** = dinero disponible ÷ días que quedan del mes (incluido hoy). `null` si por alguna razón no quedan días (no debería ocurrir en la práctica).

## Alertas

Sintetizadas, no almacenadas, a partir de datos ya calculados en otros módulos:
- **Presupuesto**: cualquier presupuesto con `alertLevel` no nulo (ver `docs/budgets.md`). Severidad `critical` a partir de 100%, `warning` a partir de 90%, `info` a partir de 70%.
- **Objetivo de ahorro**: cualquier objetivo `ACTIVE` con `progress.isOnTrack === false` (por detrás del ritmo esperado).
- **Recurrente próximo**: un grupo recurrente activo con `nextEstimatedDate` dentro de los próximos 3 días.

## Verificado con el ejemplo del enunciado

Reproducido en [`dashboard.isolation.spec.ts`](../apps/api/src/dashboard/dashboard.isolation.spec.ts) y comprobado por HTTP: con una cuenta de 23.840 € y el mismo mes de ingresos/gastos del ejemplo original, `summary` devuelve exactamente `{income: 3250, expenses: 2180, savings: 1070, savingsRate: 32.9}` y `netWorth.netWorth` es `23840` — los mismos números del enunciado.

## Aislamiento entre usuarios

El endpoint no añade ninguna consulta propia a la base de datos más allá de las ya cubiertas por los servicios que compone; su aislamiento depende enteramente del de esos servicios (ya verificado en cada uno). Se añade una comprobación explícita en [`dashboard.isolation.spec.ts`](../apps/api/src/dashboard/dashboard.isolation.spec.ts) de que el saldo/cuenta de otro usuario no aparece en ningún campo del dashboard.

## Fuera de alcance en este bloque

- Sin auditoría (solo lectura, no muta nada).
- Las alertas no se persisten ni se marcan como leídas/descartadas — se recalculan en cada petición.
- Comparación interanual todavía no incluida (ver `docs/analytics-engine.md`).
