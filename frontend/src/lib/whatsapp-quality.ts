import type { WhatsAppPhoneInfo, WhatsAppQualityRating } from "@/types";

export type QualityRisk = "ok" | "warn" | "block";

export type QualityBlockReason =
  | "red"
  | "restricted"
  | "flagged"
  | "disconnected"
  | "deleted";

export type QualityWarnReason = "yellow" | "unknown_rating" | "unknown_phone";

export interface WhatsAppQualityAssessment {
  risk: QualityRisk;
  blockReason?: QualityBlockReason;
  warnReason?: QualityWarnReason;
  qualityRating: WhatsAppQualityRating | null;
  phoneStatus: string | null;
}

const BLOCKED_STATUSES = new Set(["RESTRICTED", "FLAGGED", "DISCONNECTED", "DELETED"]);

export function formatMessagingLimit(limit?: string): string | null {
  if (!limit) return null;
  const match = limit.match(/^TIER_(\d+)$/);
  if (match) {
    const n = Number(match[1]);
    if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K / 24h`;
    return `${n} / 24h`;
  }
  return limit.replace(/_/g, " ");
}

export function assessWhatsAppQuality(
  phone: WhatsAppPhoneInfo | null | undefined
): WhatsAppQualityAssessment {
  if (!phone) {
    return {
      risk: "warn",
      warnReason: "unknown_phone",
      qualityRating: null,
      phoneStatus: null,
    };
  }

  const qualityRating = phone.qualityRating ?? "NA";
  const phoneStatus = phone.status ?? "UNKNOWN";

  if (qualityRating === "RED") {
    return { risk: "block", blockReason: "red", qualityRating, phoneStatus };
  }

  if (phoneStatus === "RESTRICTED") {
    return { risk: "block", blockReason: "restricted", qualityRating, phoneStatus };
  }

  if (phoneStatus === "FLAGGED") {
    return { risk: "block", blockReason: "flagged", qualityRating, phoneStatus };
  }

  if (phoneStatus === "DISCONNECTED") {
    return { risk: "block", blockReason: "disconnected", qualityRating, phoneStatus };
  }

  if (phoneStatus === "DELETED") {
    return { risk: "block", blockReason: "deleted", qualityRating, phoneStatus };
  }

  if (qualityRating === "YELLOW") {
    return { risk: "warn", warnReason: "yellow", qualityRating, phoneStatus };
  }

  if (qualityRating === "NA") {
    return { risk: "warn", warnReason: "unknown_rating", qualityRating, phoneStatus };
  }

  return { risk: "ok", qualityRating, phoneStatus };
}

export function isBlockedPhoneStatus(status: string): boolean {
  return BLOCKED_STATUSES.has(status);
}
