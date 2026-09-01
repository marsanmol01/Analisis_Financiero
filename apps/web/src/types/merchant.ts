// Tipado minimo, de solo lectura: la gestion completa de comercios (alta, edicion, alias)
// llega en su propio bloque del frontend. Aqui solo se usa para resolver nombres en listados.
export interface Merchant {
  id: string;
  name: string;
}
