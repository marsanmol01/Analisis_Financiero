import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import type { DashboardResponse } from "../types/dashboard";

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardResponse>("/dashboard"),
  });
}
