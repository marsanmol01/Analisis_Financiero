import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import type { ClassificationRule, ClassificationRuleInput } from "../types/classification-rule";

export const RULES_QUERY_KEY = ["classification-rules"] as const;

export function useClassificationRules() {
  return useQuery({
    queryKey: RULES_QUERY_KEY,
    queryFn: () => api.get<ClassificationRule[]>("/classification-rules"),
  });
}

function useInvalidateRules() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: RULES_QUERY_KEY });
}

export function useCreateRule() {
  const invalidate = useInvalidateRules();
  return useMutation({
    mutationFn: (input: ClassificationRuleInput) => api.post<ClassificationRule>("/classification-rules", input),
    onSuccess: invalidate,
  });
}

export function useUpdateRule() {
  const invalidate = useInvalidateRules();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ClassificationRuleInput }) =>
      api.patch<ClassificationRule>(`/classification-rules/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useDeleteRule() {
  const invalidate = useInvalidateRules();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/classification-rules/${id}`),
    onSuccess: invalidate,
  });
}

export function useReclassify() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accountId?: string) =>
      api.post<{ scanned: number; updated: number }>("/classification/reclassify", { accountId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
