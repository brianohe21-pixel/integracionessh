"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { buildCampaignExportFilename } from "@/lib/campaign-csv";
import { downloadCampaignResultsPdf } from "@/lib/campaign-results-pdf";
import type { Campaign, CampaignMetrics } from "@/types";

export function useCampaignExport(campaign: Campaign | undefined) {
  const [isExporting, setIsExporting] = useState(false);
  const [isEmailing, setIsEmailing] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportError, setExportError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [pdfError, setPdfError] = useState("");
  const [emailSuccess, setEmailSuccess] = useState("");

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

  async function emailSendRecords(to: string[]) {
    if (!campaign) return;
    setEmailError("");
    setEmailSuccess("");
    setIsEmailing(true);
    try {
      const result = await api.post<{
        messageId: string;
        filename: string;
        recipients: string[];
      }>(`/campaigns/${encodeURIComponent(campaign.campaignId)}/export/email`, { to });
      setEmailSuccess(result.recipients.join(", "));
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Email failed");
      throw err;
    } finally {
      setIsEmailing(false);
    }
  }

  async function exportResultsPdf(
    metrics: CampaignMetrics | null | undefined,
    labels: Parameters<typeof downloadCampaignResultsPdf>[0]["labels"]
  ) {
    if (!campaign) return;
    setPdfError("");
    setIsExportingPdf(true);
    try {
      await downloadCampaignResultsPdf({
        campaign,
        metrics,
        labels,
      });
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "PDF export failed");
    } finally {
      setIsExportingPdf(false);
    }
  }

  return {
    exportSendRecords,
    emailSendRecords,
    exportResultsPdf,
    isExporting,
    isEmailing,
    isExportingPdf,
    exportError,
    emailError,
    pdfError,
    emailSuccess,
    setEmailError,
    setEmailSuccess,
    canExport,
  };
}
