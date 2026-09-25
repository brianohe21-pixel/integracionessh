"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { resolveOpsAlertsSettings } from "@/lib/ops-alerts";
import type { OpsAlert, OpsAlertsSettings } from "@/types";

async function fetchOpsAlertsSettings(): Promise<OpsAlertsSettings> {
  const data = await api.get<OpsAlertsSettings>("/tenants/me/ops-alerts");
  return resolveOpsAlertsSettings(data);
}

async function fetchOpsAlertsHistory(unreadOnly = false): Promise<OpsAlert[]> {
  const query = unreadOnly ? "?unreadOnly=true&limit=50" : "?limit=50";
  const data = await api.get<{ alerts: OpsAlert[] }>(`/tenants/me/ops-alerts/history${query}`);
  return data.alerts ?? [];
}

export function useOpsAlertsSettings() {
  return useQuery({
    queryKey: ["ops-alerts-settings"],
    queryFn: fetchOpsAlertsSettings,
  });
}

export function useSaveOpsAlertsSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: OpsAlertsSettings) =>
      api.put<OpsAlertsSettings>("/tenants/me/ops-alerts", settings),
    onSuccess: (data) => {
      queryClient.setQueryData(["ops-alerts-settings"], resolveOpsAlertsSettings(data));
    },
  });
}

export function useOpsAlertsHistory(unreadOnly = false) {
  return useQuery({
    queryKey: ["ops-alerts-history", unreadOnly],
    queryFn: () => fetchOpsAlertsHistory(unreadOnly),
  });
}

export function useMarkOpsAlertRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (alertId: string) =>
      api.post<OpsAlert>(`/tenants/me/ops-alerts/${encodeURIComponent(alertId)}/read`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ops-alerts-history"] });
    },
  });
}

export function useMarkAllOpsAlertsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ marked: number }>("/tenants/me/ops-alerts/read-all", {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ops-alerts-history"] });
    },
  });
}
