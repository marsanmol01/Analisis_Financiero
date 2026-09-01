# Objetivos de ahorro (Fase 3, bloque 3)

## Dos modos de progreso, excluyentes

- **Automático** (`accountId` fijado): el progreso **es** el saldo actual de esa cuenta. Si sube o baja el saldo, el objetivo lo refleja al instante sin que nadie lo toque — no se guarda ningún snapshot, se lee en vivo en cada consulta.
- **Manual** (`accountId` vacío): el progreso es `currentAmount`, un importe que el usuario actualiza a mano vía `PATCH`.

Intentar fijar `currentAmount` a mano en un objetivo vinculado a una cuenta se rechaza con `400` — el saldo de la cuenta ya es la fuente de verdad, dejar editar `currentAmount` en paralelo lo dejaría desincronizado sin que nadie lo notase. Desvincular la cuenta (`accountId: null`) permite volver a fijarlo a mano en la misma petición.

## Cálculos (lógica pura, `savings-goal-math.ts`)

- **Ahorro realizado** = progreso actual − importe inicial.
- **% completado** = ahorro realizado / (objetivo − importe inicial) × 100. Esta fórmula generaliza tanto "ahorrar 12.000 € desde cero" (inicial = 0) como "aumentar mi fondo de 10.000 a 15.000 €" (inicial = 10.000) con la misma cuenta.
- **Ahorro mensual necesario** = restante / meses hasta la fecha límite. `null` si la fecha límite ya pasó (no tiene sentido recomendar una cuota mensual para una fecha que ya no existe).
- **Desviación** = ahorro realizado − ahorro esperado a estas alturas (calculado linealmente entre fecha inicial y fecha límite). Negativa = por detrás del ritmo necesario.
- **Proyección de fecha de finalización**: al ritmo real de ahorro desde el inicio (ahorro realizado / meses transcurridos), cuándo se alcanzaría el objetivo. `null` si todavía no se ha ahorrado nada (ritmo cero o negativo no se puede proyectar hacia adelante).

Los "meses" se miden como duraciones de 365,25/12 días (mes "medio"), no con aritmética de calendario — una aproximación deliberada para no lidiar con meses de distinta longitud y overflow de día-de-mes; introduce un margen de hasta ~3 días por mes, aceptable para una cifra orientativa.

Nada de esto se persiste: se recalcula en cada lectura (`GET /savings-goals`, `GET /savings-goals/:id`), igual que el progreso de presupuestos y el equivalente mensual de recurrentes.

## Estado y finalización

`status` (`ACTIVE`/`COMPLETED`/`ABANDONED`) es un campo que controla el usuario, no se muta automáticamente al leer un objetivo aunque su progreso llegue al 100% — evita efectos secundarios en una petición `GET`. En su lugar se expone `progress.isComplete` (booleano calculado) para que el cliente pueda sugerir marcarlo como completado.

## Validaciones al crear/editar

- `targetAmount` debe ser mayor que `initialAmount` (si no, el objetivo ya estaría cumplido o sería imposible).
- `targetDate` debe ser posterior a `startDate`.
- La cuenta vinculada, si se indica, debe pertenecer al usuario.

## Aislamiento entre usuarios

Mismo patrón que el resto de módulos. Verificado en [`savings-goals.isolation.spec.ts`](../apps/api/src/savings-goals/savings-goals.isolation.spec.ts).

## Fuera de alcance en este bloque

- Sin auditoría dedicada (mismo criterio que presupuestos/recurrentes/comercios: no cambia clasificación financiera).
- Sin "contribuciones" individuales registradas (aportaciones puntuales con fecha); el modo manual solo guarda el importe acumulado actual, no un historial de aportaciones.
- Sin objetivos compartidos entre varias cuentas (un objetivo se vincula, como mucho, a una única cuenta).
