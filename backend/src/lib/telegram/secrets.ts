import {
  SecretsManagerClient,
  GetSecretValueCommand,
  PutSecretValueCommand,
  CreateSecretCommand,
  ResourceNotFoundException,
} from "@aws-sdk/client-secrets-manager";
import { randomUUID } from "crypto";

export interface TelegramSecretPayload {
  botToken: string;
  webhookSecret: string;
}

function secretId(environment: string, tenantId: string, botId: string): string {
  return `/${environment}/tenants/${tenantId}/bots/${botId}/telegram`;
}

export async function getTelegramBotToken(
  tenantId: string,
  botId: string,
  environment: string
): Promise<string> {
  const secret = await getTelegramSecrets(tenantId, botId, environment);
  return secret.botToken;
}

export async function getTelegramWebhookSecret(
  tenantId: string,
  botId: string,
  environment: string
): Promise<string> {
  const secret = await getTelegramSecrets(tenantId, botId, environment);
  return secret.webhookSecret;
}

export async function getTelegramSecrets(
  tenantId: string,
  botId: string,
  environment: string
): Promise<TelegramSecretPayload> {
  const client = new SecretsManagerClient({});
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretId(environment, tenantId, botId) })
  );
  return JSON.parse(response.SecretString ?? "{}") as TelegramSecretPayload;
}

export async function saveTelegramSecret(
  tenantId: string,
  botId: string,
  environment: string,
  payload: { botToken: string; webhookSecret?: string }
): Promise<TelegramSecretPayload> {
  const client = new SecretsManagerClient({});
  const id = secretId(environment, tenantId, botId);
  const fullPayload: TelegramSecretPayload = {
    botToken: payload.botToken,
    webhookSecret: payload.webhookSecret ?? randomUUID(),
  };
  const secretString = JSON.stringify(fullPayload);

  try {
    await client.send(new PutSecretValueCommand({ SecretId: id, SecretString: secretString }));
  } catch (error) {
    if (!(error instanceof ResourceNotFoundException)) throw error;
    await client.send(new CreateSecretCommand({ Name: id, SecretString: secretString }));
  }

  return fullPayload;
}
