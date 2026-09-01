# Presupuestos (Fase 3, bloque 2)

## Modelo: presupuesto "estándar", no uno por mes

Un `Budget` no está atado a un mes concreto — es un importe de referencia que se compara contra el gasto real de cualquier mes que consultes (`GET /budgets/progress?month=YYYY-MM`, mes actual por defecto). Esto coincide con el ejemplo de los requisitos ("Presupuesto mensual total: 2.000 €") — no hay que recrear el presupuesto cada mes, sino que su progreso se recalcula sobre la marcha.

`categoryId: null` = presupuesto general (todo el gasto del periodo, incluido el que sí tiene una categoría con su propio presupuesto — no se restan entre sí). `categoryId` fijado = presupuesto de esa categoría concreta. Un usuario puede tener como mucho un presupuesto general y uno por categoría; la unicidad se comprueba en el servicio, no solo con la restricción de la base de datos, porque con `categoryId = NULL` Postgres no impide filas duplicadas mediante una `@@unique` (cada `NULL` se considera distinto de otro `NULL`).

`categoryId` no es editable tras la creación (`UpdateBudgetDto` solo admite `amount` e `isActive`) — cambiar la categoría de un presupuesto ya existente cambiaría su identidad; se borra y se crea uno nuevo.

## Cálculo de progreso

Por cada presupuesto activo, en el mes solicitado:
- **Gastado**: suma de gastos (`isExpense: true`) excluyendo transferencias internas (`isInternalTransfer: false`) y transacciones borradas — misma regla que el motor de estadísticas.
- **Restante** = importe del presupuesto − gastado (puede ser negativo si se ha superado).
- **% consumido** = gastado / importe × 100 (sin techo, puede superar el 100%).
- **Nivel de alerta**: el umbral más alto superado entre 70/80/90/100, o `null` si no se alcanza ni el 70%.
- **Proyección a fin de mes**: regla de tres simple sobre lo gastado hasta el día de hoy del mes (`gastado / díaDelMes × díasTotalesDelMes`). **Solo se calcula si el mes consultado es el mes en curso** — para un mes ya cerrado o futuro, proyectar no tiene sentido y se devuelve `null` en vez de un número engañoso.

## Aislamiento entre usuarios

Mismo patrón que el resto de módulos: todas las consultas van `where: { userId }` o `account: { userId }`. Verificado en [`budgets.isolation.spec.ts`](../apps/api/src/budgets/budgets.isolation.spec.ts), incluido que un gasto de 50.000 € de otro usuario no se cuela en el presupuesto general de quien consulta.

## Fuera de alcance en este bloque

- Sin auditoría dedicada (mismo criterio que categorías/comercios/recurrentes: no estaba en la lista original y no cambia clasificación financiera).
- Sin presupuestos por cuenta ni por periodo distinto de mensual (trimestral, anual...) — los requisitos originales solo dan ejemplos mensuales.
- `getProgress()` hace una consulta de agregación por presupuesto (no una sola consulta batch); a escala personal (un puñado de presupuestos) no es un problema.
