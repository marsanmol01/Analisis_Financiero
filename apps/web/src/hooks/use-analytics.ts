import { useQuery } from "@tanstack/react-query";
import { api, type QueryValue } from "../lib/api-client";
import type {
  CategoryBreakdownItem,
  MerchantBreakdownItem,
  MonthlyAmounts,
  NetWorthResult,
  SummaryResult,
} from "../types/analytics";
import type { Transaction } from "../types/transaction";

function q<T extends object>(params: T): Record<string, QueryValue> {
  return params as Record<string, QueryValue>;
}

export function useSummary(params: { month?: string; accountId?: string; compareMonths?: number } = {}) {
  return useQuery({
    queryKey: ["analytics", "summary", params],
    queryFn: () => api.get<SummaryResult>("/analytics/summary", q(params)),
  });
}

export function useMonthlyEvolution(params: { months?: number; month?: string; accountId?: string } = {}) {
  return useQuery({
    queryKey: ["analytics", "monthly-evolution", params],
    queryFn: () => api.get<MonthlyAmounts[]>("/analytics/monthly-evolution", q(params)),
  });
}

export function useByCategory(params: { from?: string; to?: string; accountId?: string } = {}) {
  return useQuery({
    queryKey: ["analytics", "by-category", params],
    queryFn: () => api.get<CategoryBreakdownItem[]>("/analytics/by-category", q(params)),
  });
}

export function useByMerchant(params: { from?: string; to?: string; accountId?: string } = {}) {
  return useQuery({
    queryKey: ["analytics", "by-merchant", params],
    queryFn: () => api.get<MerchantBreakdownItem[]>("/analytics/by-merchant", q(params)),
  });
}

export function useTopExpenses(params: { from?: string; to?: string; accountId?: string; limit?: number } = {}) {
  return useQuery({
    queryKey: ["analytics", "top-expenses", params],
    queryFn: () => api.get<Transaction[]>("/analytics/top-expenses", q(params)),
  });
}

export function useNetWorth() {
  return useQuery({
    queryKey: ["analytics", "net-worth"],
    queryFn: () => api.get<NetWorthResult>("/analytics/net-worth"),
  });
}
