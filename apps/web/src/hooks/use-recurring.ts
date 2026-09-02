import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type QueryValue } from "../lib/api-client";
import type { DetectRecurringResult, RecurringGroup, UpdateRecurringInput } from "../types/recurring";

export function useRecurringGroups(filters: { accountId?: string; isActive?: boolean } = {}) {
  return useQuery({
    queryKey: ["recurring", filters],
    queryFn: () => api.get<RecurringGroup[]>("/recurring", filters as Record<string, QueryValue>),
  });
}

function useInvalidateRecurring() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["recurring"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };
}

export function useDetectRecurring() {
  const invalidate = useInvalidateRecurring();
  return useMutation({
    mutationFn: (accountId?: string) => api.post<DetectRecurringResult>("/recurring/detect", { accountId }),
    onSuccess: invalidate,
  });
}

export function useCreateManualRecurring() {
  const invalidate = useInvalidateRecurring();
  return useMutation({
    mutationFn: (transactionIds: string[]) => api.post<RecurringGroup>("/recurring/manual", { transactionIds }),
    onSuccess: invalidate,
  });
}

export function useUpdateRecurring() {
  const invalidate = useInvalidateRecurring();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateRecurringInput }) =>
      api.patch<RecurringGroup>(`/recurring/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useDeleteRecurring() {
  const invalidate = useInvalidateRecurring();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/recurring/${id}`),
    onSuccess: invalidate,
  });
}
