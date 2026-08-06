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
      const filename = buildCampaignExportFilename(campaign);
      await api.download(
        `/campaigns/${encodeURIComponent(campaign.campaignId)}/export`,
        filename
      );
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  }

  return { exportSendRecords, isExporting, exportError, canExport };
}
