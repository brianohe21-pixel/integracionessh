import type { WhatsAppPhoneInfo } from "./client.js";

export type WhatsAppQualityRisk = "ok" | "warn" | "block";

export type WhatsAppQualityBlockReason =
  | "red"
  | "restricted"
  | "flagged"
  | "disconnected"
  | "deleted";

export type WhatsAppQualityWarnReason = "yellow" | "unknown_rating" | "unknown_phone";

export interface WhatsAppQualityAssessment {
  risk: WhatsAppQualityRisk;
  blockReason?: WhatsAppQualityBlockReason;
  warnReason?: WhatsAppQualityWarnReason;
  qualityRating: WhatsAppPhoneInfo["qualityRating"] | null;
  phoneStatus: string | null;
  score: number | null;
}

const RISK_ORDER: Record<WhatsAppQualityRisk, number> = {
  ok: 0,
  warn: 1,
  block: 2,
};

export function scoreWhatsAppPhone(
  phone: WhatsAppPhoneInfo | null | undefined
): number | null {
  if (!phone) return null;

  let score = 100;

  if (phone.qualityRating === "RED") score -= 70;
  else if (phone.qualityRating === "YELLOW") score -= 30;
  else if (phone.qualityRating === "NA") score -= 15;

  if (phone.status === "RESTRICTED" || phone.status === "FLAGGED") {
    score -= 80;
  } else if (phone.status === "DISCONNECTED" || phone.status === "DELETED") {
    score = 0;
  } else if (phone.status === "PENDING") {
    score -= 20;
  }

  return Math.max(0, Math.min(100, score));
}

export function assessWhatsAppPhone(
  phone: WhatsAppPhoneInfo | null | undefined
): WhatsAppQualityAssessment {
  if (!phone) {
    return {
      risk: "warn",
      warnReason: "unknown_phone",
      qualityRating: null,
      phoneStatus: null,
      score: null,
    };
  }

  const qualityRating = phone.qualityRating ?? "NA";
  const phoneStatus = phone.status ?? "UNKNOWN";
  const score = scoreWhatsAppPhone(phone);

  if (qualityRating === "RED") {
    return { risk: "block", blockReason: "red", qualityRating, phoneStatus, score };
  }

  if (phoneStatus === "RESTRICTED") {
    return { risk: "block", blockReason: "restricted", qualityRating, phoneStatus, score };
  }

  if (phoneStatus === "FLAGGED") {
    return { risk: "block", blockReason: "flagged", qualityRating, phoneStatus, score };
  }

  if (phoneStatus === "DISCONNECTED") {
    return { risk: "block", blockReason: "disconnected", qualityRating, phoneStatus, score };
  }

  if (phoneStatus === "DELETED") {
    return { risk: "block", blockReason: "deleted", qualityRating, phoneStatus, score };
  }

  if (qualityRating === "YELLOW") {
    return { risk: "warn", warnReason: "yellow", qualityRating, phoneStatus, score };
  }

  if (qualityRating === "NA") {
    return { risk: "warn", warnReason: "unknown_rating", qualityRating, phoneStatus, score };
  }

  return { risk: "ok", qualityRating, phoneStatus, score };
}

export function pickWorstWhatsAppAssessment(
  assessments: WhatsAppQualityAssessment[]
): WhatsAppQualityAssessment | null {
  if (!assessments.length) return null;

  return assessments.reduce((worst, current) =>
    RISK_ORDER[current.risk] > RISK_ORDER[worst.risk] ? current : worst
  );
}
