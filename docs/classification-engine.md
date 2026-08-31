# Motor de clasificación

## Capas activas (Fase 2, bloque 1)

1. **Manual**: si el usuario ya asignó una categoría a mano (`PATCH /transactions/:id`), nada la sobrescribe automáticamente — ni una importación posterior, ni `reclassify`.
2. **Reglas del usuario** (`ClassificationRule`), evaluadas por `priority` ascendente, la primera que casa gana. Operadores: `CONTAINS`, `STARTS_WITH`, `ENDS_WITH`, `EXACT`, `REGEX` (con captura de errores: una regex inválida en tiempo de ejecución simplemente no casa, nunca lanza). Filtros opcionales por cuenta (`accountId`) y rango de importe (`minAmount`/`maxAmount`).
3. **Comercio con categoría por defecto**: si ninguna regla casa, se busca si la descripción contiene algún alias de un `Merchant` del usuario. Si el comercio tiene `defaultCategoryId`, se usa esa categoría (`source: "merchant"`, `confidence: 0.8`). Si el comercio se detecta pero no tiene categoría por defecto, se etiqueta la transacción con `merchantId` igualmente (información útil) pero queda sin categoría.
4. Si nada casa, la transacción queda sin clasificar (`categoryId: null`) para revisión manual — punto de partida de la cola de revisión mencionada en el diseño original.

Las capas de heurísticas por palabras clave y de IA (Fase 4) todavía no existen; cuando se añadan, entrarán **después** de estas dos, nunca antes — la prioridad de lo determinista sobre la IA es un principio explícito del proyecto.

## Decisión de alcance: "comercio" no es (todavía) un operador de regla

Los requisitos originales listan "merchant" como un tipo de operador de regla, además de "comercio con categoría por defecto" como mecanismo independiente. En este bloque solo se implementa el segundo. Añadir el primero exigiría resolver el comercio de una transacción *antes* de evaluar las reglas (para poder filtrar por él), lo que cambia el orden del pipeline; se ha preferido no acoplar ambos mecanismos todavía. Si en el uso real hace falta "aplica esta categoría a todo lo de este comercio, pero solo en esta cuenta" (que hoy no se puede expresar con un `Merchant.defaultCategoryId` global), se revisará entonces.

## Cuándo se clasifica

- **Al confirmar una importación** (`POST /imports/confirm`): cada fila nueva se clasifica antes de insertarse, usando un único `RuleSet` cargado una vez para todo el lote (no una consulta por fila).
- **Bajo demanda** (`POST /classification/reclassify`, con `accountId` opcional): recorre las transacciones no borradas de una cuenta (o de todas) cuya `classificationSource` no sea `manual`, y vuelve a aplicarles el motor con el `RuleSet` actual. Pensado para cuando añades o cambias una regla y quieres que se aplique retroactivamente a lo ya importado.

## Comercios y alias

Un `Merchant` es del usuario (no hay comercios "del sistema" precargados, a diferencia de las categorías). Sus `MerchantAlias` son patrones de texto normalizados (mayúsculas, espacios colapsados) que se comparan por `contains` contra la descripción normalizada de la transacción. Cuando varios alias casan, gana el patrón más largo (más específico) — por ejemplo, "MERCADONA EXPRESS" gana a "MERCADONA" si ambos están dados de alta. Esta garantía vive dentro de `classify()`, no depende de que quien construya el `RuleSet` lo entregue pre-ordenado.

## Correcciones que enseñan al sistema (requisito 4.7)

Al corregir una transacción con `PATCH /transactions/:id`, además de `categoryId` se pueden pasar dos flags opcionales (solo tienen efecto si `categoryId` viene informado):

- **`applyToSimilar`**: aplica la misma categoría a otras transacciones de cualquier cuenta del usuario con la **misma descripción normalizada exacta**, siempre que no estén ya clasificadas manualmente (nunca pisa una corrección previa del usuario). Devuelve `similarUpdatedCount`.
- **`createRule`**: crea una `ClassificationRule` con operador `CONTAINS` y como valor la descripción normalizada completa de esa transacción, apuntando a la categoría elegida. La regla queda marcada `createdVia: "correction"` (frente a `"manual"` para las creadas directamente en `POST /classification-rules`), pero es una regla normal: aparece en el listado, se puede editar o borrar en cualquier momento — nunca es una automatización oculta. Devuelve `ruleCreated`.

No se crean reglas "sugeridas pendientes de aprobación": el propio checkbox del usuario al corregir **es** la aprobación explícita.
