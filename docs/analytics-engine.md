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
| `GET /analytics/pay-cycle?compareCycles=` | Resumen del "ciclo de nómina" (ver más abajo): ciclo actual, anterior, y media de los últimos N ciclos completos (6 por defecto) |

## Ciclo de nómina (alternativa al mes de calendario)

Añadido a petición del usuario: en vez de medir "cuánto gasto este mes de calendario", mide "cuánto gasto desde que cobro hasta que vuelvo a cobrar" — un periodo que empieza el día real de la nómina, no el día 1 de cada mes.

- **Cómo se detecta el inicio de un ciclo**: cualquier ingreso (`isIncome: true`) categorizado con la categoría del sistema **"Nómina"**, de cualquiera de las cuentas del usuario (el cálculo es deliberadamente global entre cuentas, no por cuenta — la vida financiera del usuario es una sola). No hay heurística de importe ni de descripción: es una decisión explícita del usuario, categorizar el ingreso, lo que abre un ciclo — igual que con cualquier otra categoría, se puede automatizar creando una regla de clasificación una sola vez.
- **Pagas extra**: existe una categoría del sistema separada, **"Paga extra"** (hermana de "Nómina" dentro de "Ingresos"). Un ingreso categorizado así **suma como ingreso del ciclo en el que cae, pero nunca abre un ciclo nuevo por sí mismo**. Es la razón de ser de tener dos categorías de ingreso salarial distintas en vez de una sola.
- **Cálculo puro**: [`pay-cycle.ts`](../apps/api/src/analytics/pay-cycle.ts) — `buildPayCycles(nominaDatesAsc, now)` construye un ciclo por cada fecha de nómina (`[fecha_i, fecha_i+1)`, exclusivo), con el último abierto hasta `now`. Sin base de datos, testeado a fondo por separado.
- **Qué expone cada periodo** (`PayCyclePeriod`): fecha de inicio/fin, si sigue abierto, días transcurridos, ingresos/gastos/ahorro/tasa de ahorro totales del periodo, y por separado `salaryIncome` (solo lo categorizado "Nómina") y `extraIncome` (solo lo categorizado "Paga extra") dentro de ese mismo periodo — para poder mostrar "de tus 3.100 €, 600 € son paga extra" sin que se confunda con el ingreso recurrente real.
- **Sin ninguna nómina categorizada todavía**: `hasSalaryData: false`, `current`/`previous`/`average` a `null` — nunca un error. El resto de la aplicación (resumen por mes de calendario, presupuestos, etc.) sigue funcionando exactamente igual; esto es una vista adicional, no un reemplazo.
- El desglose por categoría de cada ciclo reutiliza la misma consulta que `by-category` (`groupByCategory`, extraída como método privado compartido) con los límites exactos del ciclo, en vez de duplicar la lógica de agregación.
- Cubierto por [`pay-cycle.spec.ts`](../apps/api/src/analytics/pay-cycle.spec.ts) (cálculo puro de límites de ciclo) y una integración real en [`analytics.isolation.spec.ts`](../apps/api/src/analytics/analytics.isolation.spec.ts) con un usuario dedicado (necesario porque el ciclo abierto se extiende hasta "ahora": compartir cuenta con otro test de este mismo fichero contaminaría el cálculo) que verifica los tres ciclos (dos completos + uno abierto) y que la paga extra no desplaza ningún límite.

## Diseño: una sola consulta por resumen, cálculo en memoria

`getSummary()` y `getMonthlyEvolution()` traen las transacciones del rango completo necesario **en una sola query** (fechas + importe + flags, sin cargar el resto de columnas) y hacen el bucketing por mes en JavaScript (`analytics-math.ts`, funciones puras y testeadas sin base de datos) — el mismo patrón de "cargar una vez, procesar en memoria" que ya se usó en el motor de clasificación y en la detección de transferencias/recurrentes. `getByCategory()`/`getByMerchant()` sí usan `groupBy` de Prisma (una agregación de una sola dimensión, sin bucketing temporal, encaja mejor ahí).

## Aislamiento entre usuarios

Todas las consultas van siempre `account: { userId }` (o `userId` directo en `net-worth`). Verificado explícitamente: un ingreso de 50.000 € en la cuenta de otro usuario no aparece en el resumen ni en el patrimonio del usuario que consulta.

## Fuera de alcance en este bloque

- Comparación interanual (mismo mes, años distintos) — no implementada todavía, se añadirá si hace falta al construir el dashboard.
- Gasto medio diario y "presupuesto disponible por día hasta fin de mes" — pertenecen conceptualmente al bloque de "dinero disponible" (sección 4.14), no a este motor base.
- Filtros adicionales del buscador global (etiquetas, texto libre) — sección 4.17, fuera de Fase 3 bloque 1.
