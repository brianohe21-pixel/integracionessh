import { getPhoneNumberInfo, type WhatsAppPhoneInfo } from "./client.js";

export class CampaignQualityError extends Error {
  statusCode = 422;
  code = "WHATSAPP_QUALITY_BLOCKED";

  constructor(
    message: string,
    public readonly details: {
      qualityRating: string;
      phoneStatus: string;
      reason: string;
    }
  ) {
    super(message);
  }
}

function assertPhoneQuality(info: WhatsAppPhoneInfo): void {
  if (info.qualityRating === "RED") {
    throw new CampaignQualityError(
      "Cannot start campaign: WhatsApp quality rating is low (RED). Improve message quality before sending bulk messages.",
      {
        qualityRating: info.qualityRating,
        phoneStatus: info.status,
        reason: "red",
      }
    );
  }

  if (info.status === "RESTRICTED") {
    throw new CampaignQualityError(
      "Cannot start campaign: WhatsApp phone number is restricted by Meta.",
      {
        qualityRating: info.qualityRating,
        phoneStatus: info.status,
        reason: "restricted",
      }
    );
  }

  if (info.status === "FLAGGED") {
    throw new CampaignQualityError(
      "Cannot start campaign: WhatsApp phone number is flagged by Meta.",
      {
        qualityRating: info.qualityRating,
        phoneStatus: info.status,
        reason: "flagged",
      }
    );
  }

  if (info.status === "DISCONNECTED" || info.status === "DELETED") {
    throw new CampaignQualityError(
      "Cannot start campaign: WhatsApp phone number is not connected.",
      {
        qualityRating: info.qualityRating,
        phoneStatus: info.status,
        reason: info.status.toLowerCase(),
      }
    );
  }
}

export async function assertWhatsAppQualityForCampaign(
  phoneNumberId: string,
  accessToken: string
): Promise<WhatsAppPhoneInfo> {
  const info = await getPhoneNumberInfo(phoneNumberId, accessToken);
  assertPhoneQuality(info);
  return info;
}
