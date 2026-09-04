import { randomBytes } from "crypto";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
  PutSecretValueCommand,
  CreateSecretCommand,
  DeleteSecretCommand,
  ResourceNotFoundException,
} from "@aws-sdk/client-secrets-manager";
import { getTenant } from "../dynamodb/tenant.repository.js";

export type MetaAppCredentialSource = "own" | "reseller" | "platform" | "none";

export interface MetaAppCredentialPayload {
  appId: string;
  appSecret: string;
  embeddedSignupConfigId: string;
  webhookVerifyToken: string;
}

export interface ResolvedMetaAppCredential {
  payload: MetaAppCredentialPayload;
  source: Exclude<MetaAppCredentialSource, "none">;
  ownerTenantId: string;
}

export interface MetaAppConfigStatus {
  configured: boolean;
  source: MetaAppCredentialSource;
  ownerTenantId?: string;
  appId?: string;
  embeddedSignupConfigId?: string;
  webhookUrl?: string;
  webhookVerifyToken?: string;
}

function makeClient(): SecretsManagerClient {
  return new SecretsManagerClient({});
}

function tenantSecretId(environment: string, tenantId: string): string {
  return `/${environment}/tenants/${tenantId}/meta-app`;
}

async function readSecret(secretId: string): Promise<MetaAppCredentialPayload | null> {
  const client = makeClient();
  try {
    const response = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
    return parsePayload(JSON.parse(response.SecretString ?? "{}"));
  } catch (error) {
    if (error instanceof ResourceNotFoundException) return null;
    throw error;
  }
}

async function writeSecret(secretId: string, payload: MetaAppCredentialPayload): Promise<void> {
  const client = makeClient();
  const secretString = JSON.stringify(payload);
  try {
    await client.send(new PutSecretValueCommand({ SecretId: secretId, SecretString: secretString }));
  } catch (error) {
    if (!(error instanceof ResourceNotFoundException)) throw error;
    await client.send(new CreateSecretCommand({ Name: secretId, SecretString: secretString }));
  }
}

async function removeSecret(secretId: string): Promise<void> {
  const client = makeClient();
  try {
    await client.send(
      new DeleteSecretCommand({ SecretId: secretId, ForceDeleteWithoutRecovery: true })
    );
  } catch (error) {
    if (error instanceof ResourceNotFoundException) return;
    throw error;
  }
}

export function parsePayload(raw: unknown): MetaAppCredentialPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<MetaAppCredentialPayload>;
  const appId = data.appId?.trim() ?? "";
  const appSecret = data.appSecret?.trim() ?? "";
  const embeddedSignupConfigId = data.embeddedSignupConfigId?.trim() ?? "";
  const webhookVerifyToken = data.webhookVerifyToken?.trim() ?? "";
  if (!appId || !appSecret || !embeddedSignupConfigId || !webhookVerifyToken) return null;
  return { appId, appSecret, embeddedSignupConfigId, webhookVerifyToken };
}

export function generateWebhookVerifyToken(): string {
  return randomBytes(24).toString("hex");
}

export function metaWebhookUrl(ownerTenantId: string, apiBaseUrl: string): string {
  const base = apiBaseUrl.replace(/\/$/, "");
  const owner = ownerTenantId === "platform" ? "platform" : ownerTenantId;
  return `${base}/webhook/whatsapp/${owner}`;
}

function platformPayloadFromEnv(): MetaAppCredentialPayload | null {
  const appId = process.env.META_APP_ID?.trim() ?? "";
  const appSecret =
    process.env.WHATSAPP_APP_SECRET?.trim() ||
    process.env.META_APP_SECRET?.trim() ||
    "";
  const embeddedSignupConfigId = process.env.META_EMBEDDED_SIGNUP_CONFIG_ID?.trim() ?? "";
  const webhookVerifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim() ?? "";
  if (!appId || !appSecret || !webhookVerifyToken) return null;
  return { appId, appSecret, embeddedSignupConfigId, webhookVerifyToken };
}

export async function hasTenantMetaAppCredential(
  tenantId: string,
  environment: string
): Promise<boolean> {
  const raw = await readSecret(tenantSecretId(environment, tenantId));
  return raw !== null;
}

export async function getTenantMetaAppCredential(
  tenantId: string,
  environment: string
): Promise<MetaAppCredentialPayload | null> {
  return readSecret(tenantSecretId(environment, tenantId));
}

export async function saveTenantMetaAppCredential(
  tenantId: string,
  environment: string,
  payload: MetaAppCredentialPayload
): Promise<void> {
  await writeSecret(tenantSecretId(environment, tenantId), payload);
}

export async function deleteTenantMetaAppCredential(
  tenantId: string,
  environment: string
): Promise<void> {
  await removeSecret(tenantSecretId(environment, tenantId));
}

async function resolveChain(
  tenantId: string
): Promise<Array<{ tenantId: string; source: Exclude<MetaAppCredentialSource, "none" | "platform"> }>> {
  const chain: Array<{
    tenantId: string;
    source: Exclude<MetaAppCredentialSource, "none" | "platform">;
  }> = [{ tenantId, source: "own" }];

  const tenant = await getTenant(tenantId);
  if (tenant?.parentTenantId) {
    chain.push({ tenantId: tenant.parentTenantId, source: "reseller" });
  }

  return chain;
}

export async function resolveMetaAppCredential(
  tenantId: string,
  environment: string
): Promise<ResolvedMetaAppCredential | null> {
  for (const entry of await resolveChain(tenantId)) {
    const payload = await getTenantMetaAppCredential(entry.tenantId, environment);
    if (payload) {
      return {
        payload,
        source: entry.source,
        ownerTenantId: entry.tenantId,
      };
    }
  }

  const platformPayload = platformPayloadFromEnv();
  if (platformPayload) {
    return {
      payload: platformPayload,
      source: "platform",
      ownerTenantId: "platform",
    };
  }

  return null;
}

export async function getMetaAppCredentialForOwner(
  ownerTenantId: string,
  environment: string
): Promise<MetaAppCredentialPayload | null> {
  if (ownerTenantId === "platform") {
    return platformPayloadFromEnv();
  }
  return getTenantMetaAppCredential(ownerTenantId, environment);
}

export async function getMetaAppConfigStatus(
  tenantId: string,
  environment: string,
  apiBaseUrl?: string
): Promise<MetaAppConfigStatus> {
  const own = await hasTenantMetaAppCredential(tenantId, environment);
  if (own) {
    const payload = await getTenantMetaAppCredential(tenantId, environment);
    return {
      configured: true,
      source: "own",
      ownerTenantId: tenantId,
      ...(payload?.appId ? { appId: payload.appId } : {}),
      ...(payload?.embeddedSignupConfigId
        ? { embeddedSignupConfigId: payload.embeddedSignupConfigId }
        : {}),
      ...(apiBaseUrl ? { webhookUrl: metaWebhookUrl(tenantId, apiBaseUrl) } : {}),
      ...(payload?.webhookVerifyToken ? { webhookVerifyToken: payload.webhookVerifyToken } : {}),
    };
  }

  const resolved = await resolveMetaAppCredential(tenantId, environment);
  if (!resolved) {
    return { configured: false, source: "none" };
  }

  return {
    configured: true,
    source: resolved.source,
    ownerTenantId: resolved.ownerTenantId,
    appId: resolved.payload.appId,
    embeddedSignupConfigId: resolved.payload.embeddedSignupConfigId,
    ...(apiBaseUrl
      ? { webhookUrl: metaWebhookUrl(resolved.ownerTenantId, apiBaseUrl) }
      : {}),
    ...((resolved.source === "own" || resolved.source === "reseller") &&
    resolved.payload.webhookVerifyToken
      ? { webhookVerifyToken: resolved.payload.webhookVerifyToken }
      : {}),
  };
}
