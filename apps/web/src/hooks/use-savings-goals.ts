import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import type { SavingsGoal, SavingsGoalInput, UpdateSavingsGoalInput } from "../types/savings-goal";

export function useSavingsGoals() {
  return useQuery({
    queryKey: ["savings-goals"],
    queryFn: () => api.get<SavingsGoal[]>("/savings-goals"),
  });
}

function useInvalidateSavingsGoals() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["savings-goals"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };
}

export function useCreateSavingsGoal() {
  const invalidate = useInvalidateSavingsGoals();
  return useMutation({
    mutationFn: (input: SavingsGoalInput) => api.post<SavingsGoal>("/savings-goals", input),
    onSuccess: invalidate,
  });
}

export function useUpdateSavingsGoal() {
  const invalidate = useInvalidateSavingsGoals();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateSavingsGoalInput }) =>
      api.patch<SavingsGoal>(`/savings-goals/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useDeleteSavingsGoal() {
  const invalidate = useInvalidateSavingsGoals();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/savings-goals/${id}`),
    onSuccess: invalidate,
  });
}
