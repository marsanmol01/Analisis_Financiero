// Consejos deterministas (nada de IA): observaciones simples sobre datos ya calculados por
// analytics/budgets. Prioridad explicita del proyecto: reglas deterministas sobre automatismos
// de IA (reservados a una fase futura y nunca activados sin que el usuario lo pida).

export interface InsightCategoryTotal {
  categoryId: string | null;
  categoryName: string | null;
  total: number;
}

export interface InsightPeriod {
  income: number;
  expenses: number;
  savingsRate: number | null;
  byCategory: InsightCategoryTotal[]; // solo gastos, ya ordenado de mayor a menor
}

export interface Insight {
  severity: "positive" | "info" | "warning";
  message: string;
}

const CATEGORY_INCREASE_MIN_PERCENT = 15;
const CATEGORY_INCREASE_MIN_ABSOLUTE = 20;
const SAVINGS_RATE_BELOW_AVERAGE_THRESHOLD = 10; // puntos porcentuales
const SAVINGS_RATE_ABOVE_AVERAGE_THRESHOLD = 5;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function buildInsights(input: {
  periodLabel: string;
  current: InsightPeriod;
  previous: InsightPeriod | null;
  averageSavingsRate: number | null;
}): Insight[] {
  const { periodLabel, current, previous, averageSavingsRate } = input;
  const insights: Insight[] = [];

  // 1. Gastas mas de lo que ingresas: la unica alerta que se antepone a las demas.
  if (current.savingsRate !== null && current.savingsRate < 0) {
    const overspend = round1(current.expenses - current.income);
    insights.push({
      severity: "warning",
      message: `${periodLabel[0].toUpperCase()}${periodLabel.slice(1)} has gastado ${overspend}€ más de lo que has ingresado.`,
    });
  }

  // 2. Tasa de ahorro frente a tu propia media.
  if (current.savingsRate !== null && averageSavingsRate !== null) {
    const diff = round1(current.savingsRate - averageSavingsRate);
    if (diff <= -SAVINGS_RATE_BELOW_AVERAGE_THRESHOLD) {
      insights.push({
        severity: "warning",
        message: `Tu tasa de ahorro ${periodLabel} (${current.savingsRate}%) es notablemente menor que tu media (${averageSavingsRate}%).`,
      });
    } else if (diff >= SAVINGS_RATE_ABOVE_AVERAGE_THRESHOLD) {
      insights.push({
        severity: "positive",
        message: `Tu tasa de ahorro ${periodLabel} (${current.savingsRate}%) supera tu media (${averageSavingsRate}%) — sigue así.`,
      });
    }
  }

  // 3. Categoria de mayor gasto.
  const topCategory = current.byCategory[0];
  if (topCategory && current.expenses > 0) {
    const share = round1((topCategory.total / current.expenses) * 100);
    insights.push({
      severity: "info",
      message: `Tu mayor gasto ${periodLabel} es "${topCategory.categoryName ?? "Sin categoría"}": ${topCategory.total}€ (${share}% del total).`,
    });
  }

  // 4. Categoria que ha subido mas frente al periodo anterior.
  if (previous) {
    const previousByCategory = new Map(previous.byCategory.map((c) => [c.categoryId, c.total]));
    let biggestIncrease: { name: string; diff: number; percent: number } | null = null;

    for (const category of current.byCategory) {
      const previousTotal = previousByCategory.get(category.categoryId) ?? 0;
      const diff = round1(category.total - previousTotal);
      if (diff < CATEGORY_INCREASE_MIN_ABSOLUTE) continue;
      const percent = previousTotal > 0 ? round1((diff / previousTotal) * 100) : null;
      if (percent !== null && percent < CATEGORY_INCREASE_MIN_PERCENT) continue;
      if (!biggestIncrease || diff > biggestIncrease.diff) {
        biggestIncrease = { name: category.categoryName ?? "Sin categoría", diff, percent: percent ?? 100 };
      }
    }

    if (biggestIncrease) {
      insights.push({
        severity: "warning",
        message: `Has gastado ${biggestIncrease.diff}€ más en "${biggestIncrease.name}" que en el periodo anterior (+${biggestIncrease.percent}%).`,
      });
    }
  }

  return insights;
}
