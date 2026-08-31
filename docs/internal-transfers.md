# Detección de transferencias internas

## Motor de matching (`transfer-matcher.ts`, lógica pura)

Voraz, sin base de datos: recibe la lista de movimientos salientes (importe negativo) y entrantes (importe positivo) de las cuentas del usuario, y para cada saliente (procesados en orden de fecha) busca, entre los entrantes aún libres, el que:

- tiene el **mismo importe absoluto**;
- está en una **cuenta distinta** (nunca la misma cuenta);
- cae dentro de la **ventana de tolerancia** en días (3 por defecto, configurable por petición vía `toleranceDays` en `POST /transfers/detect`; no persistido todavía como preferencia de usuario — pendiente de que exista una entidad `user_settings`).

De entre los candidatos válidos, se queda con el de **menor distancia en días**. Un entrante ya usado no puede volver a emparejarse con otro saliente en la misma ejecución.

## Confianza y autoconfirmación

```
confianza = 1 - (díasDeDistancia / (toleranciaDías + 1)) * 0.4
```

Mismo día → confianza 1.0. En el borde de la tolerancia (3 días con tolerancia 3) → confianza 0.7. Umbral de autoconfirmación: **0.9** (mismo día o ±1 día). Por debajo del umbral, el match se crea como `PENDING` para que el usuario lo revise.

## Estado y reversibilidad

Cada match propuesto o confirmado es un registro `InternalTransfer` (`PENDING` / `CONFIRMED` / `REJECTED`) que enlaza las dos transacciones (`outgoingTransactionId`, `incomingTransactionId`, ambos `@unique` — una transacción no puede pertenecer a más de una transferencia). El campo `isInternalTransfer` de cada `Transaction` **solo se activa mientras el estado es `CONFIRMED`**; en `PENDING` o `REJECTED` la transacción sigue contando como ingreso/gasto normal, tal como exige el requisito original.

Un único `PATCH /transfers/:id { status }` sirve para confirmar, rechazar o deshacer (volver a `PENDING`) — siempre sincroniza el flag en ambas transacciones dentro de la misma transacción de base de datos. `confirmedVia` (`"auto"` | `"manual"` | `null`) deja siempre claro si la confirmación la hizo el motor o el usuario, igual que `ClassificationRule.createdVia`.

## Idempotencia

`detect()` excluye de sus candidatos cualquier transacción que ya tenga **cualquier** `InternalTransfer` asociado, sea cual sea su estado — incluidas las `REJECTED`. Volver a ejecutar la detección no relitiga una decisión ya tomada por el usuario ni duplica propuestas. Verificado en [`transfers.isolation.spec.ts`](../apps/api/src/transfers/transfers.isolation.spec.ts).

## Aislamiento entre usuarios

Los dos pools de candidatos (salientes/entrantes) se consultan siempre `where: { account: { userId } }`; nunca puede proponerse un match cruzando datos de dos usuarios distintos, ni siquiera con importe y fecha idénticos (verificado explícitamente en el test de integración). `TransfersService.findOne`/`updateStatus` devuelven `404` si la transferencia no pertenece al usuario.

## Fuera de alcance en este bloque

- Tolerancia de importe para comisiones (ej. sale -1000€, entra +998€ por una comisión de red): se exige coincidencia exacta del importe absoluto. Añadir tolerancia de importe requeriría decidir un umbral razonable (¿€? ¿%?) que hoy no está especificado; se revisará si aparece como necesidad real.
- Preferencia persistida de tolerancia de días por usuario (ver arriba).
- Exclusión automática de `isInternalTransfer=true` en endpoints de estadísticas: no existen todavía (Fase 3). El flag ya está correctamente mantenido y listo para que el dashboard lo use.
