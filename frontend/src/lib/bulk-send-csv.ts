import { buildCsv, downloadCsvFile } from "@/lib/csv";
import { api } from "@/lib/api";
import type { BulkSendFailure, BulkSendJob, BulkSendFailuresResponse } from "@/hooks/useBulkSend";

const HISTORY_HEADERS = [
  "job_id",
  "template",
  "language",
  "status",
  "total",
  "sent",
  "failed",
  "delivery_failed",
  "created_at",
  "updated_at",
];

const FAILURE_HEADERS = ["phone", "type", "error_code", "error_title", "error_message", "failed_at", "message_id"];

function failureKindLabel(kind: BulkSendFailure["kind"]): string {
  return kind === "delivery" ? "delivery" : "send";
}

function statusLabel(status: BulkSendJob["status"]): string {
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  if (status === "processing") return "processing";
  return "queued";
}

export function downloadBulkHistoryCsv(jobs: BulkSendJob[]): void {
  const rows = jobs.map((job) => [
    job.jobId,
    job.templateName,
    job.language,
    statusLabel(job.status),
    String(job.total),
    String(job.sent),
    String(job.failed),
    String(job.deliveryFailed ?? 0),
    job.createdAt,
    job.updatedAt,
  ]);
  const content = buildCsv(HISTORY_HEADERS, rows);
  const date = new Date().toISOString().slice(0, 10);
  downloadCsvFile(`historial_envio_masivo_${date}.csv`, content);
}

function failuresToRows(items: BulkSendFailure[]): string[][] {
  return items.map((item) => [
    item.to,
    failureKindLabel(item.kind),
    item.errorCode != null ? String(item.errorCode) : "",
    item.errorTitle ?? "",
    item.errorMessage,
    item.failedAt,
    item.messageId ?? "",
  ]);
}

export async function downloadBulkJobFailuresCsv(job: BulkSendJob): Promise<void> {
  const data = await api.get<BulkSendFailuresResponse>(
    `/bulk-send/${encodeURIComponent(job.jobId)}/failures?limit=1000`
  );

  if (data.total === 0) {
    const summaryRow = [
      "",
      "summary",
      "",
      "",
      `No failures recorded. Sent: ${job.sent}, Failed: ${job.failed}, Delivery failed: ${job.deliveryFailed ?? 0}`,
      job.updatedAt,
      "",
    ];
    const content = buildCsv(FAILURE_HEADERS, [summaryRow]);
    downloadCsvFile(`fallos_${job.templateName}_${job.jobId.slice(0, 8)}.csv`, content);
    return;
  }

  const content = buildCsv(FAILURE_HEADERS, failuresToRows(data.items));
  downloadCsvFile(`fallos_${job.templateName}_${job.jobId.slice(0, 8)}.csv`, content);
}
