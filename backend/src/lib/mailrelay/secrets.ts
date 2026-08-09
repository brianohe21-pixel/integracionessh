import {
  GetSecretValueCommand,
  PutSecretValueCommand,
  ResourceNotFoundException,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import type { MailrelayCredentials, MaskedMailrelayCredentials } from "../../types/index.js";

const client = new SecretsManagerClient({});

export interface PlatformMailrelaySecret extends MailrelayCredentials {
  eventSubscriptionId?: number;
}

export function platformMailrelaySecretId(environment: string): string {
  return `/${environment}/platform/mailrelay`;
}

export function maskMailrelayCredentials(
  credentials: MailrelayCredentials | null
): MaskedMailrelayCredentials {
  if (!credentials) return { configured: false };
  const suffix = credentials.apiKey.slice(-4);
  return {
    configured: true,
    apiKey: suffix ? `********${suffix}` : "********",
    webhookToken: "********",
  };
}

export async function getPlatformMailrelaySecret(
  environment: string
): Promise<PlatformMailrelaySecret | null> {
  try {
    const response = await client.send(
      new GetSecretValueCommand({ SecretId: platformMailrelaySecretId(environment) })
    );
    const value = JSON.parse(response.SecretString ?? "{}") as Partial<PlatformMailrelaySecret>;
    if (!value.apiKey || !value.webhookToken) return null;
    return {
      apiKey: value.apiKey,
      webhookToken: value.webhookToken,
      ...(typeof value.eventSubscriptionId === "number" && value.eventSubscriptionId > 0
        ? { eventSubscriptionId: value.eventSubscriptionId }
        : {}),
    };
  } catch (error) {
    if (error instanceof ResourceNotFoundException) return null;
    throw error;
  }
}

export async function getMailrelayCredentials(
  environment: string
): Promise<MailrelayCredentials | null> {
  const secret = await getPlatformMailrelaySecret(environment);
  if (!secret) return null;
  return { apiKey: secret.apiKey, webhookToken: secret.webhookToken };
}

export async function savePlatformMailrelayEventSubscriptionId(
  environment: string,
  eventSubscriptionId: number
): Promise<void> {
  const secret = await getPlatformMailrelaySecret(environment);
  if (!secret) {
    throw new Error(
      `Mailrelay platform secret is not configured at ${platformMailrelaySecretId(environment)}`
    );
  }
  await client.send(
    new PutSecretValueCommand({
      SecretId: platformMailrelaySecretId(environment),
      SecretString: JSON.stringify({ ...secret, eventSubscriptionId }),
    })
  );
}

export async function clearPlatformMailrelayEventSubscriptionId(environment: string): Promise<void> {
  const secret = await getPlatformMailrelaySecret(environment);
  if (!secret) return;
  const { eventSubscriptionId: _removed, ...rest } = secret;
  void _removed;
  await client.send(
    new PutSecretValueCommand({
      SecretId: platformMailrelaySecretId(environment),
      SecretString: JSON.stringify(rest),
    })
  );
}
