import { getMailrelayConfig } from "../dynamodb/mailrelay.repository.js";
import type { EmailMarketingProvider, MailrelayConfig } from "../../types/index.js";
import { createNrs360Client, type Nrs360Client } from "./client.js";
import { getNrs360Credentials, maskNrs360Credentials } from "./secrets.js";
import {
  getMailrelayCredentials,
  maskMailrelayCredentials,
} from "../mailrelay/secrets.js";
import type { MaskedMailrelayCredentials } from "../../types/index.js";

export function resolveProvider(config: MailrelayConfig | null): EmailMarketingProvider {
  return config?.provider === "nrs360" ? "nrs360" : "mailrelay";
}

export async function getEmailMarketingConfig(tenantId: string): Promise<MailrelayConfig | null> {
  return getMailrelayConfig(tenantId);
}

export async function getMaskedEmailMarketingCredentials(params: {
  environment: string;
  tenantId: string;
  provider: EmailMarketingProvider;
}): Promise<MaskedMailrelayCredentials> {
  if (params.provider === "nrs360") {
    const credentials = await getNrs360Credentials(params.environment, params.tenantId);
    return maskNrs360Credentials(credentials);
  }
  const credentials = await getMailrelayCredentials(params.environment);
  return maskMailrelayCredentials(credentials);
}

export async function createAuthenticatedNrs360Client(
  environment: string,
  tenantId: string
): Promise<{ client: Nrs360Client; credentials: NonNullable<Awaited<ReturnType<typeof getNrs360Credentials>>> }> {
  const credentials = await getNrs360Credentials(environment, tenantId);
  if (!credentials) {
    throw Object.assign(new Error("360nrs credentials are not configured for this account"), {
      statusCode: 400,
    });
  }
  return { client: createNrs360Client(credentials), credentials };
}

export function requireNrs360Sender(config: MailrelayConfig): {
  fromEmail: string;
  fromName?: string;
  replyTo: string;
} {
  const fromEmail = config.fromEmail?.trim().toLowerCase() ?? "";
  const replyTo = (config.replyTo?.trim() || fromEmail).toLowerCase();
  if (!fromEmail || !replyTo) {
    throw Object.assign(
      new Error("Configure fromEmail and replyTo before sending with 360nrs"),
      { statusCode: 400 }
    );
  }
  return {
    fromEmail,
    replyTo,
    ...(config.fromName?.trim() ? { fromName: config.fromName.trim() } : {}),
  };
}
