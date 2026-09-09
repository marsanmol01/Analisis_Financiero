# Sistema de importación

## Arquitectura

```
BankImporter (interfaz: parse(buffer) -> { headers, rows })
├── GenericCsvImporter   (csv-parse, detecta delimitador , ; \t, quita BOM)
├── GenericXlsxImporter  (exceljs — XLSX moderno, formato OOXML/ZIP)
└── LegacyXlsImporter    (xlsx/SheetJS — XLS legacy Excel 97-2003, formato OLE2/BIFF)
```

Añadir un importador específico de un banco (`BancoXImporter`, `RevolutImporter`...) más adelante consiste en implementar `BankImporter` y registrarlo en `ImportsService.resolveImporter()` — no requiere tocar el resto del pipeline.

### XLS legacy (Excel 97-2003)

`exceljs` (usado por `GenericXlsxImporter`) solo sabe leer el formato OOXML moderno (`.xlsx`); un `.xls` binario antiguo, como los que exporta Sabadell, le es completamente opaco. `LegacyXlsImporter` usa la librería `xlsx` (SheetJS) para leerlos, enrutado por extensión/mimetype en `resolveImporter()` (`.xls` / `application/vnd.ms-excel`).

Algunos extractos (de nuevo, el caso real de Sabadell) anteponen un bloque de metadatos (título, fecha de generación, IBAN, titular...) antes de la fila de cabecera real de la tabla. `LegacyXlsImporter` escanea como máximo las primeras 30 filas no vacías buscando la primera que `detectColumnMapping()` reconozca como cabecera válida, y descarta todo lo anterior. Si ninguna fila es reconocible, cae al mismo comportamiento que el resto de importadores (asume la primera fila como cabecera y delega en el mapeo manual del usuario).

**Nota de dependencia**: la versión de `xlsx` publicada en el registro de npm (`0.18.5`) tiene dos CVEs "high" sin parche disponible en npm (prototype pollution y ReDoS). SheetJS solo publica versiones parcheadas en su propio CDN (`cdn.sheetjs.com`), no en npm, por un conflicto de distribución ajeno a este proyecto. Por eso `package.json` fija la dependencia directamente a `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` (canal de distribución oficial del propio mantenedor) en vez de a una versión de npm — con esa versión, `npm audit` no reporta ninguna vulnerabilidad para `xlsx`.

## Flujo: preview → confirm (sin estado intermedio en servidor)

1. **`POST /imports/preview`** (multipart: `file`, `accountId`, `columnMapping` opcional): parsea el fichero, detecta o aplica el mapeo de columnas, normaliza cada fila (fecha, importe, descripción), calcula su huella y consulta si ya existe en la cuenta. **No persiste nada** — ni siquiera si el fichero está vacío o todas las filas fallan.
2. El cliente revisa el resultado (filas `new` / `duplicate` / `error`) y decide qué filas enviar.
3. **`POST /imports/confirm`** (JSON: `accountId`, `filename`, `rows`): el servidor **recalcula la huella de cada fila a partir de sus datos**, nunca de la que venga en el JSON — evita que un cliente (o un fichero corrupto) fuerce la importación de un duplicado falsificando la huella. Inserta con `createMany({ skipDuplicates: true })`, que además usa la restricción única `(accountId, fingerprint)` de la base de datos como red de seguridad final ante importaciones concurrentes.
4. Se crea un registro en `imports` con los contadores (`totalRows`, `importedCount`, `duplicateCount`, `errorCount`) y se audita como `IMPORT_CREATED`.

Los campos `status`, `reason` y `fingerprint` que trae cada fila del preview se aceptan en `confirm` pero se ignoran deliberadamente — el flujo esperado del cliente es reenviar tal cual los objetos del preview tras filtrarlos por `status`.

## Detección de columnas

`detectColumnMapping()` reconoce alias en español/inglés (`fecha`/`date`, `concepto`/`description`, `importe`/`amount`, `debe`/`haber` o `debit`/`credit`, `referencia`, `moneda`), incluyendo los nombres reales de columna de Sabadell (`f. operativa` → fecha, `f. valor` → fecha valor). Si no puede identificar con confianza fecha + descripción + (importe o debe/haber), el preview devuelve `{ status: "needs_mapping", headers }` en vez de adivinar — el cliente debe reenviar con un `columnMapping` explícito. Esto es lo esperado, por ejemplo, con el extracto de Revolut (columna `Fecha de inicio`, sin alias reconocido todavía) — se resuelve mapeando manualmente una vez, no requiere cambio de código.

## Huella (fingerprint) y duplicados

`sha256(accountId + fecha ISO + importe con 2 decimales + descripción normalizada + referencia)`. No depende solo de una referencia bancaria (puede no existir). La comprobación de duplicados ocurre en tres niveles: dentro del propio fichero (dos filas idénticas), contra transacciones ya existentes en la cuenta, y como último resorte la restricción única de PostgreSQL.

**Nota de diseño**: la comprobación de "ya existe" excluye transacciones borradas (`deletedAt != null`), pero la restricción única de la base de datos no distingue borradas de activas. Si se borra una transacción y se reimporta el mismo movimiento, la base de datos rechaza la fila duplicada (se cuenta como `duplicateCount`, no se pierde ni se duplica nada), pero tampoco "revive" la transacción borrada. Es un comportamiento aceptado por ahora; se revisará si en la práctica resulta confuso.

## Calidad de datos

- **Importes**: admite coma o punto decimal, miles, signo delante o formato contable con paréntesis, símbolo de moneda, y un código de moneda ISO 4217 pegado directamente al número sin espacio (p. ej. `-20,99EUR`, formato real visto en el extracto de CaixaBank). Ante ambigüedad real (p. ej. texto no numérico) devuelve `null` → la fila se marca `error`, nunca se asume un valor.
- **Fechas**: `YYYY-MM-DD`, `DD/MM/YYYY`, `DD-MM-YYYY`, `DD.MM.YYYY`, `YYYY/MM/DD`, en modo estricto (rechaza `32/13/2026`). Se ancla a medianoche UTC del día detectado para no desplazar el día por la zona horaria del servidor.
- **Filas vacías**: se ignoran sin contar como error. Una fila con contenido pero campos clave vacíos/ilegibles sí se marca como `error` y aparece en el preview — nunca se descarta en silencio.
- **Límite de tamaño**: 15 MB por fichero (multer) y 20.000 filas por importación, para evitar agotamiento de memoria con un fichero enorme o malicioso.

## Seguridad

- `POST /imports/preview` y `POST /imports/confirm` requieren sesión y la cabecera anti-CSRF (ver `docs/security.md`).
- Ambos endpoints verifican que la cuenta indicada pertenece al usuario autenticado antes de tocar nada (`AccountsService.findOne`); si no, `404`.
- No se ejecuta ningún contenido de las celdas (no hay `eval` ni interpretación de fórmulas). El riesgo de inyección de fórmulas (CSV/Excel) solo aplicaría si estos datos se reexportan y se abren en Excel — se abordará explícitamente en la fase de exportación (`docs/architecture.md`, sección 15 de los requisitos), no antes.
