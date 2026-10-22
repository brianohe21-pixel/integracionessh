"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { buildCampaignExportFilename } from "@/lib/campaign-csv";
import type { Campaign } from "@/types";

export function useCampaignExport(campaign: Campaign | undefined) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const canExport =
    campaign &&
    campaign.status !== "draft" &&
    campaign.status !== "scheduled";

  async function exportSendRecords() {
    if (!campaign) return;
    setExportError("");
    setIsExporting(true);
    try {
      const fallbackFilename = buildCampaignExportFilename(campaign);
      const result = await api.get<{ downloadUrl: string; filename: string }>(
        `/campaigns/${encodeURIComponent(campaign.campaignId)}/export`
      );
      if (!result.downloadUrl) {
        throw new Error("Export download URL missing");
      }
      const anchor = document.createElement("a");
      anchor.href = result.downloadUrl;
      anchor.download = result.filename || fallbackFilename;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  }

  return { exportSendRecords, isExporting, exportError, canExport };
}
