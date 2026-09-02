import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type QueryValue } from "../lib/api-client";
import type { Budget, BudgetInput, BudgetProgress, UpdateBudgetInput } from "../types/budget";

export function useBudgets() {
  return useQuery({
    queryKey: ["budgets", "list"],
    queryFn: () => api.get<Budget[]>("/budgets"),
  });
}

export function useBudgetsProgress(month?: string) {
  return useQuery({
    queryKey: ["budgets", "progress", month],
    queryFn: () => api.get<BudgetProgress[]>("/budgets/progress", { month } as Record<string, QueryValue>),
  });
}

function useInvalidateBudgets() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["budgets"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };
}

export function useCreateBudget() {
  const invalidate = useInvalidateBudgets();
  return useMutation({
    mutationFn: (input: BudgetInput) => api.post<Budget>("/budgets", input),
    onSuccess: invalidate,
  });
}

export function useUpdateBudget() {
  const invalidate = useInvalidateBudgets();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateBudgetInput }) => api.patch<Budget>(`/budgets/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useDeleteBudget() {
  const invalidate = useInvalidateBudgets();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/budgets/${id}`),
    onSuccess: invalidate,
  });
}
