// Normalizacion basica de la descripcion bancaria para huella/visualizacion consistente.
// La normalizacion "de verdad" (extraer el comercio, aliases, etc.) es del motor de
// clasificacion en Fase 2; aqui solo homogeneizamos espacios/mayusculas.
export function normalizeDescription(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toUpperCase();
}
