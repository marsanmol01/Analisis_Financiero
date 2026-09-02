import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import type { DashboardResponse } from "../types/dashboard";

export function useDashboard(evolutionMonths?: number) {
  return useQuery({
    queryKey: ["dashboard", evolutionMonths],
    queryFn: () => api.get<DashboardResponse>("/dashboard", { evolutionMonths }),
  });
}
