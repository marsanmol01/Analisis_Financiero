# Detección de gastos recurrentes

## Agrupación

Transacciones de gasto (importe negativo, no transferencia interna, no borradas) agrupadas por **comercio** (`merchantId`) si está identificado, o si no, por **descripción normalizada**, siempre dentro de la misma cuenta. Un grupo con menos de 2 ocurrencias no se analiza.

## Algoritmo (`recurring-detector.ts`, lógica pura)

1. **Consistencia de importe**: todos los importes del grupo deben estar dentro de **±20%** de la media. Si no, se descarta — evita confundir "compro a menudo en el mismo sitio" (importe variable) con una suscripción real (importe estable).
2. **Intervalos entre ocurrencias consecutivas**: se calcula la media de días entre fechas.
3. **Clasificación de frecuencia**: si la media encaja en uno de los periodos estándar (semanal ~7d, mensual ~30d, trimestral ~91d, semestral ~182d, anual ~365d, cada uno con su tolerancia) **y además cada intervalo individual** se acerca también a ese periodo (no solo la media), esa es la frecuencia.
4. Si no encaja en ningún periodo estándar, se marca `OTHER` — pero solo si hay **al menos 3 ocurrencias** y los intervalos son razonablemente regulares entre sí (para no marcar como recurrente algo irregular por pura coincidencia).
5. **Importe habitual**: la mediana (no la media) de los importes, más robusta ante algún valor atípico.
6. **Confianza**: combina el número de ocurrencias (más ocurrencias, más confianza, hasta 5) y la consistencia del importe. Rango 0.3–1.

## Coste mensual/anual equivalente

`monthlyEquivalent()` normaliza cualquier frecuencia a un coste mensual comparable (`importe / díasDelPeriodo × 30`), y el anual es ese valor ×12. Se calculan al vuelo en cada lectura (`GET /recurring`, `GET /recurring/:id`), no se guardan en base de datos — evita que queden desactualizados si se corrige `typicalAmount` o `frequency` más adelante.

## Re-ejecutar la detección

`POST /recurring/detect` es idempotente en el sentido de que **actualiza** el grupo existente (misma cuenta + comercio/descripción) en vez de crear uno duplicado cuando aparece una nueva ocurrencia — refresca `frequency`, `typicalAmount`, `lastDate`, `nextEstimatedDate` y `confidence`, y enlaza también las transacciones que faltaran. Nunca toca `isManual`, `isActive` ni `categoryId`, que quedan bajo control del usuario.

## Grupos manuales

`POST /recurring/manual` (requisito 4.10: "también poder marcar movimientos manualmente como recurrentes") recibe una lista de `transactionIds` elegidos por el usuario, valida que todas pertenezcan a la misma cuenta y tengan el mismo signo (no se puede mezclar ingresos y gastos), y reutiliza el mismo `detectRecurringPattern()` para calcular frecuencia/importe/próxima fecha — si las transacciones elegidas no muestran ningún patrón mínimamente consistente, se rechaza con un mensaje claro en vez de crear un grupo sin sentido.

Un grupo manual (`isManual: true`) queda **completamente exento** de la detección automática: `POST /recurring/detect` excluye del todo las transacciones ya vinculadas a un grupo manual, así que nunca compite con él ni le arrebata transacciones para formar un grupo automático con la misma clave.

## Enlace con transacciones

`Transaction.recurringGroupId` es opcional y `onDelete: SetNull` — borrar un `RecurringGroup` (`DELETE /recurring/:id`) desvincula sus transacciones sin borrarlas ni afectar a su categoría o clasificación.

## Aislamiento entre usuarios

Igual que el resto de motores: los candidatos a agrupar se consultan siempre `where: { account: { userId } }`, y `findOne`/`update`/`remove` devuelven `404` si el grupo no pertenece al usuario. Verificado en [`recurring.isolation.spec.ts`](../apps/api/src/recurring/recurring.isolation.spec.ts), incluyendo el caso explícito de que no se agrupan transacciones de dos usuarios distintos aunque coincidan comercio e importe.

## Fuera de alcance en este bloque

- Sin auditoría dedicada (no estaba en la lista de eventos original; a diferencia de una regla de clasificación o una transferencia, marcar algo como recurrente no cambia por sí solo ninguna cifra de ingresos/gastos).
- Sin desactivación automática de un grupo cuyo patrón deja de cumplirse (p. ej. una suscripción cancelada cuyo importe empieza a variar mucho en transacciones no relacionadas). El grupo persiste hasta que el usuario lo desactive o borre a mano.
- Sin tolerancia configurable por el usuario para la consistencia de importe (±20% fijo) ni para los umbrales de cada bucket de frecuencia.
