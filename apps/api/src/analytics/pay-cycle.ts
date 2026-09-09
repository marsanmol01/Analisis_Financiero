// Calculos puros (sin base de datos) sobre el "ciclo de nomina": en vez de mes de calendario,
// el periodo va desde que se cobra la nomina hasta que se cobra la siguiente. Una paga extra no
// abre un ciclo nuevo — solo un ingreso categorizado como "Nomina" lo hace.

export interface PayCycleBounds {
  start: Date;
  end: Date; // exclusivo salvo que isOpen (entonces es "ahora", tambien exclusivo de facto)
  isOpen: boolean;
}

// nominaDatesAsc: fecha de cada ingreso categorizado como "Nomina", ya ordenadas ascendente.
// Cada fecha abre un ciclo que dura hasta la siguiente fecha de nomina (exclusiva); el ultimo
// ciclo queda abierto hasta `now`. Sin fechas, no hay ningun ciclo que devolver.
export function buildPayCycles(nominaDatesAsc: Date[], now: Date): PayCycleBounds[] {
  return nominaDatesAsc.map((start, index) => {
    const isLast = index === nominaDatesAsc.length - 1;
    return { start, end: isLast ? now : nominaDatesAsc[index + 1], isOpen: isLast };
  });
}

export function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)));
}
