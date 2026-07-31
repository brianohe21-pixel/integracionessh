import type { CampaignBatchConfig } from "../../types/index.js";

export const MIN_BATCH_SIZE = 1;
export const MAX_BATCH_SIZE = 1000;
export const MIN_BATCH_DELAY_SECONDS = 60;
export const MAX_BATCH_DELAY_SECONDS = 86_400;
export const DEFAULT_BATCH_SIZE = 100;
export const DEFAULT_BATCH_DELAY_SECONDS = 300;

export function campaignStartScheduleName(campaignId: string): string {
  return `campaign-${campaignId}`;
}

export function campaignBatchScheduleName(campaignId: string): string {
  return `campaign-batch-${campaignId}`;
}

export function computeNextBatchAt(delaySeconds: number, from = new Date()): Date {
  return new Date(from.getTime() + delaySeconds * 1000);
}

export function toSchedulerExpression(date: Date): string {
  return `at(${date.toISOString().slice(0, 19)})`;
}

export function validateBatchConfig(config: CampaignBatchConfig): string | null {
  if (!Number.isInteger(config.size) || config.size < MIN_BATCH_SIZE || config.size > MAX_BATCH_SIZE) {
    return `Batch size must be an integer between ${MIN_BATCH_SIZE} and ${MAX_BATCH_SIZE}`;
  }
  if (
    !Number.isInteger(config.delaySeconds) ||
    config.delaySeconds < MIN_BATCH_DELAY_SECONDS ||
    config.delaySeconds > MAX_BATCH_DELAY_SECONDS
  ) {
    return `Batch delay must be an integer between ${MIN_BATCH_DELAY_SECONDS} and ${MAX_BATCH_DELAY_SECONDS} seconds`;
  }
  return null;
}

export function estimateBatchCount(totalRecipients: number, batchSize: number): number {
  if (totalRecipients <= 0 || batchSize <= 0) return 0;
  return Math.ceil(totalRecipients / batchSize);
}

export function formatDelaySeconds(seconds: number): string {
  if (seconds % 3600 === 0) {
    const hours = seconds / 3600;
    return `${hours}h`;
  }
  if (seconds % 60 === 0) {
    const minutes = seconds / 60;
    return `${minutes}m`;
  }
  return `${seconds}s`;
}
