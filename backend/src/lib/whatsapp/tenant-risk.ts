import { listBots } from "../dynamodb/bot.repository.js";
import { getPhoneNumberInfo, getWhatsAppAccessToken } from "./client.js";
import {
  assessWhatsAppPhone,
  pickWorstWhatsAppAssessment,
  type WhatsAppQualityAssessment,
} from "./assess-quality.js";
import type { WhatsAppQualityRating } from "./client.js";

export type TenantWhatsAppRiskLevel = "ok" | "warn" | "block" | "none";

export interface TenantWhatsAppRiskSummary {
  risk: TenantWhatsAppRiskLevel;
  score: number | null;
  connectedNumbers: number;
  qualityRating: WhatsAppQualityRating | null;
  phoneStatus: string | null;
}

function toTenantRisk(
  assessment: WhatsAppQualityAssessment | null,
  connectedNumbers: number
): TenantWhatsAppRiskSummary {
  if (!assessment || connectedNumbers === 0) {
    return {
      risk: "none",
      score: null,
      connectedNumbers,
      qualityRating: null,
      phoneStatus: null,
    };
  }

  return {
    risk: assessment.risk,
    score: assessment.score,
    connectedNumbers,
    qualityRating: assessment.qualityRating,
    phoneStatus: assessment.phoneStatus,
  };
}

export async function getTenantWhatsAppRisk(
  tenantId: string,
  environment: string
): Promise<TenantWhatsAppRiskSummary> {
  const result = await getTenantWhatsAppRiskByBot(tenantId, environment);
  return result.tenant;
}

export interface TenantWhatsAppRiskResponse {
  tenant: TenantWhatsAppRiskSummary;
  byBot: Record<string, TenantWhatsAppRiskSummary>;
}

export async function getTenantWhatsAppRiskByBot(
  tenantId: string,
  environment: string
): Promise<TenantWhatsAppRiskResponse> {
  const bots = await listBots(tenantId);
  const whatsappBots = bots.filter((bot) => bot.phoneNumberId?.trim());

  if (!whatsappBots.length) {
    return { tenant: toTenantRisk(null, 0), byBot: {} };
  }

  let accessToken: string | undefined;
  try {
    accessToken = await getWhatsAppAccessToken(tenantId, environment);
  } catch {
    const fallback = assessWhatsAppPhone(null);
    const byBot = Object.fromEntries(
      whatsappBots.map((bot) => [
        bot.botId,
        {
          risk: fallback.risk,
          score: fallback.score,
          connectedNumbers: 1,
          qualityRating: fallback.qualityRating,
          phoneStatus: fallback.phoneStatus,
        } satisfies TenantWhatsAppRiskSummary,
      ])
    );
    return {
      tenant: toTenantRisk(fallback, whatsappBots.length),
      byBot,
    };
  }

  const entries = await Promise.all(
    whatsappBots.map(async (bot) => {
      try {
        const phone = await getPhoneNumberInfo(bot.phoneNumberId, accessToken!);
        const assessment = assessWhatsAppPhone(phone);
        return { botId: bot.botId, assessment };
      } catch {
        return { botId: bot.botId, assessment: assessWhatsAppPhone(null) };
      }
    })
  );

  const byBot = Object.fromEntries(
    entries.map(({ botId, assessment }) => [
      botId,
      {
        risk: assessment.risk,
        score: assessment.score,
        connectedNumbers: 1,
        qualityRating: assessment.qualityRating,
        phoneStatus: assessment.phoneStatus,
      } satisfies TenantWhatsAppRiskSummary,
    ])
  );

  const worst = pickWorstWhatsAppAssessment(entries.map((entry) => entry.assessment));
  const scores = entries
    .map((entry) => entry.assessment.score)
    .filter((score): score is number => score !== null);

  return {
    tenant: worst
      ? {
          risk: worst.risk,
          score: scores.length ? Math.min(...scores) : worst.score,
          connectedNumbers: whatsappBots.length,
          qualityRating: worst.qualityRating,
          phoneStatus: worst.phoneStatus,
        }
      : toTenantRisk(null, whatsappBots.length),
    byBot,
  };
}
