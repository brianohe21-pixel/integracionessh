"use client";

import { useState } from "react";
import { api } from "@/lib/api";

export function useMetricsExport() {
  const [isExporting, setIsExporting] = useState(false);

  async function exportMetrics() {
    setIsExporting(true);
    try {
      const date = new Date().toISOString().slice(0, 10);
      await api.download("/metrics/export", `metrics-${date}.csv`);
    } finally {
      setIsExporting(false);
    }
  }

  return { exportMetrics, isExporting };
}
