"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface BulkRecipient {
  to: string;
  components?: Array<{
    type: string;
    parameters?: Array<{ type: string; text?: string }>;
  }>;
}

export type BulkSendFailureKind = "send" | "delivery";

export interface BulkSendFailure {
  jobId: string;
  tenantId: string;
  kind: BulkSendFailureKind;
  to: string;
  messageId?: string;
  errorCode?: number;
  errorTitle?: string;
  errorMessage: string;
  failedAt: string;
}

export interface BulkSendFailureSummary {
  kind: BulkSendFailureKind;
  errorCode?: number;
  errorTitle: string;
  count: number;
}

export interface BulkSendFailuresResponse {
  jobId: string;
  items: BulkSendFailure[];
  summary: BulkSendFailureSummary[];
  total: number;
}

export interface BulkSendJob {
  jobId: string;
  tenantId: string;
  botId: string;
  templateName: string;
  language: string;
  status: "queued" | "processing" | "completed" | "failed";
  total: number;
  sent: number;
  failed: number;
  deliveryFailed: number;
  createdAt: string;
  updatedAt: string;
}

export interface BulkSendInput {
  botId: string;
  templateName: string;
  language: string;
  recipients: BulkRecipient[];
  onProgress?: (job: BulkSendJob) => void;
}

export interface BulkSendResult {
  jobId: string;
  sent: number;
  failed: number;
  deliveryFailed: number;
  total: number;
  status: BulkSendJob["status"];
}

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 30 * 60 * 1000;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollJob(
  jobId: string,
  onProgress?: (job: BulkSendJob) => void
): Promise<BulkSendJob> {
  const started = Date.now();

  while (Date.now() - started < POLL_TIMEOUT_MS) {
    const job = await api.get<BulkSendJob>(`/bulk-send/${jobId}`);
    onProgress?.(job);

    if (job.status === "completed" || job.status === "failed") {
      return job;
    }

    await delay(POLL_INTERVAL_MS);
  }

  throw new Error("bulk_send_timeout");
}

export function useBulkHistory() {
  return useQuery({
    queryKey: ["bulk-history"],
    queryFn: () => api.get<BulkSendJob[]>("/bulk-send"),
    refetchInterval: 30_000,
  });
}

export function useBulkSend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: BulkSendInput): Promise<BulkSendResult> => {
      const job = await api.post<BulkSendJob>("/bulk-send", {
        botId: data.botId,
        templateName: data.templateName,
        language: data.language,
        recipients: data.recipients,
      });

      data.onProgress?.(job);

      const finalJob = await pollJob(job.jobId, data.onProgress);

      return {
        jobId: finalJob.jobId,
        sent: finalJob.sent,
        failed: finalJob.failed,
        deliveryFailed: finalJob.deliveryFailed ?? 0,
        total: finalJob.total,
        status: finalJob.status,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bulk-history"] });
    },
  });
}
