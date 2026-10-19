"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { MetricsDateRange } from "@/lib/metrics-date-range";
import type { WhatsAppCategoryReport } from "@/types";

function isWhatsAppCategoryReport(data: unknown): data is WhatsAppCategoryReport {
  if (!data || typeof data !== "object") return false;
  const report = data as WhatsAppCategoryReport;
  return (
    typeof report.from === "string" &&
    typeof report.to === "string" &&
    Array.isArray(report.daily) &&
    Array.isArray(report.byCategory) &&
    Boolean(report.totals) &&
    typeof report.totals.marketing === "number" &&
    typeof report.totals.utility === "number" &&
    typeof report.totals.authentication === "number" &&
    typeof report.totals.service === "number"
  );
}

async function fetchWhatsAppCategoryReport(
  range: MetricsDateRange,
  botId?: string
): Promise<WhatsAppCategoryReport> {
  const params = new URLSearchParams({
    from: range.from,
    to: range.to,
  });
  if (botId) params.set("botId", botId);
  const data = await api.get<WhatsAppCategoryReport>(
    `/metrics/whatsapp-categories?${params.toString()}`
  );
  if (!isWhatsAppCategoryReport(data)) {
    throw new Error("Invalid WhatsApp category report response");
  }
  return data;
}

export function useWhatsAppCategoryReport(
  range: MetricsDateRange | null,
  botId?: string,
  enabled = false
) {
  return useQuery({
    queryKey: [
      "reports",
      "whatsapp-categories",
      range?.from ?? "",
      range?.to ?? "",
      botId ?? "all",
    ],
    queryFn: () => fetchWhatsAppCategoryReport(range!, botId),
    enabled: enabled && Boolean(range?.from && range?.to),
    retry: false,
  });
}

export function useWhatsAppCategoryMetrics(
  from?: string,
  to?: string,
  botId?: string
) {
  const range =
    from && to
      ? { from, to }
      : null;
  return useQuery({
    queryKey: [
      "metrics",
      "whatsapp-categories",
      from ?? "default",
      to ?? "default",
      botId ?? "all",
    ],
    queryFn: () => fetchWhatsAppCategoryReport(range!, botId),
    enabled: Boolean(range),
    refetchInterval: 60_000,
    retry: false,
  });
}
