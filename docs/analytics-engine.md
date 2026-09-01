# Motor de estadísticas (Fase 3, bloque 1)

Módulo de solo lectura (`AnalyticsModule`): ninguna ruta muta datos, así que no lleva guard CSRF ni auditoría.

## Regla de oro: excluir transferencias internas

**Todas** las agregaciones de ingresos/gastos filtran explícitamente `isInternalTransfer: false`. Una transacción puede tener `isIncome: true` y a la vez ser parte de una transferencia confirmada — el flag `isIncome`/`isExpense` nunca se muta al confirmar una transferencia (ver `docs/internal-transfers.md`), así que la exclusión tiene que hacerse siempre en la consulta, nunca asumirse. Verificado explícitamente en [`analytics.isolation.spec.ts`](../apps/api/src/analytics/analytics.isolation.spec.ts) — es el test que cubre el caso exigido en los requisitos: *"una transferencia interna no suma gasto ni ingreso"*.

## Patrimonio / saldo consolidado

Se calcula sumando el campo `Account.balance` (el saldo bancario conocido, no un cálculo derivado del historial de transacciones importadas — que podría estar incompleto si no se ha importado todo el histórico). Convención de signo: una cuenta de tipo `LOAN` se trata como **pasivo**; se espera que su saldo se guarde en negativo (importe adeudado). El resto de tipos se tratan como **activo**. Es una simplificación deliberada — el diseño original pedía "sencillo en la primera versión pero ampliable"; si en el futuro hace falta distinguir, por ejemplo, una tarjeta de crédito con saldo pendiente (pasivo) de una tarjeta de débito (activo), habrá que añadir esa distinción explícitamente en vez de inferirla del `AccountType`.

## Endpoints

| Endpoint | Qué calcula |
|---|---|
| `GET /analytics/summary?month=YYYY-MM&accountId=&compareMonths=` | Ingresos/gastos/ahorro/tasa de ahorro del mes, comparado con el mes anterior y con la media de los últimos N meses (6 por defecto) |
| `GET /analytics/monthly-evolution?months=&month=&accountId=` | Serie mensual de ingresos/gastos/ahorro/tasa |
| `GET /analytics/by-category?from=&to=&accountId=` | Gasto agrupado por categoría, ordenado de mayor a menor |
| `GET /analytics/by-merchant?from=&to=&accountId=` | Gasto agrupado por comercio, ordenado de mayor a menor |
| `GET /analytics/top-expenses?from=&to=&accountId=&limit=` | Las N transacciones de mayor gasto del periodo |
| `GET /analytics/net-worth` | Patrimonio neto, desglosado en activos/pasivos por cuenta |

## Diseño: una sola consulta por resumen, cálculo en memoria

`getSummary()` y `getMonthlyEvolution()` traen las transacciones del rango completo necesario **en una sola query** (fechas + importe + flags, sin cargar el resto de columnas) y hacen el bucketing por mes en JavaScript (`analytics-math.ts`, funciones puras y testeadas sin base de datos) — el mismo patrón de "cargar una vez, procesar en memoria" que ya se usó en el motor de clasificación y en la detección de transferencias/recurrentes. `getByCategory()`/`getByMerchant()` sí usan `groupBy` de Prisma (una agregación de una sola dimensión, sin bucketing temporal, encaja mejor ahí).

## Aislamiento entre usuarios

Todas las consultas van siempre `account: { userId }` (o `userId` directo en `net-worth`). Verificado explícitamente: un ingreso de 50.000 € en la cuenta de otro usuario no aparece en el resumen ni en el patrimonio del usuario que consulta.

## Fuera de alcance en este bloque

- Comparación interanual (mismo mes, años distintos) — no implementada todavía, se añadirá si hace falta al construir el dashboard.
- Gasto medio diario y "presupuesto disponible por día hasta fin de mes" — pertenecen conceptualmente al bloque de "dinero disponible" (sección 4.14), no a este motor base.
- Filtros adicionales del buscador global (etiquetas, texto libre) — sección 4.17, fuera de Fase 3 bloque 1.
