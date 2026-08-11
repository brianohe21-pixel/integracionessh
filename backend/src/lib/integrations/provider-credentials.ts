import {
  SecretsManagerClient,
  GetSecretValueCommand,
  PutSecretValueCommand,
  CreateSecretCommand,
  DeleteSecretCommand,
  ResourceNotFoundException,
} from "@aws-sdk/client-secrets-manager";
import { getTenant } from "../dynamodb/tenant.repository.js";

export type ProviderId = "openai" | "telnyx" | "elevenlabs";

export type CredentialSource = "own" | "reseller" | "platform" | "none";

export interface TelnyxCredentialPayload {
  apiKey: string;
  connectionId: string;
  publicKey?: string;
}

export interface OpenAICredentialPayload {
  apiKey: string;
}

export interface ElevenLabsCredentialPayload {
  apiKey: string;
}

export type ProviderPayloadMap = {
  openai: OpenAICredentialPayload;
  telnyx: TelnyxCredentialPayload;
  elevenlabs: ElevenLabsCredentialPayload;
};

export interface ResolvedCredential<P> {
  payload: P;
  source: Exclude<CredentialSource, "none">;
  ownerTenantId: string;
}

export interface ProviderCredentialStatus {
  provider: ProviderId;
  configured: boolean;
  source: CredentialSource;
  ownerTenantId?: string;
  webhookUrl?: string;
}

function makeClient(): SecretsManagerClient {
  return new SecretsManagerClient({});
}

function tenantSecretId(environment: string, tenantId: string, provider: ProviderId): string {
  return `/${environment}/tenants/${tenantId}/${provider}`;
}

function platformSecretId(environment: string, provider: ProviderId): string {
  return `/${environment}/platform/${provider}`;
}

async function readSecret<T>(secretId: string): Promise<T | null> {
  const client = makeClient();
  try {
    const response = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
    return JSON.parse(response.SecretString ?? "{}") as T;
  } catch (error) {
    if (error instanceof ResourceNotFoundException) return null;
    throw error;
  }
}

async function writeSecret(secretId: string, payload: unknown): Promise<void> {
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

function parseOpenAI(payload: Partial<OpenAICredentialPayload> | null): OpenAICredentialPayload | null {
  const apiKey = payload?.apiKey?.trim() ?? "";
  if (!apiKey) return null;
  return { apiKey };
}

function parseTelnyx(payload: Partial<TelnyxCredentialPayload> | null): TelnyxCredentialPayload | null {
  const apiKey = payload?.apiKey?.trim() ?? "";
  const connectionId = payload?.connectionId?.trim() ?? "";
  if (!apiKey || !connectionId) return null;
  return {
    apiKey,
    connectionId,
    ...(payload?.publicKey?.trim() ? { publicKey: payload.publicKey.trim() } : {}),
  };
}

function parseElevenLabs(
  payload: Partial<ElevenLabsCredentialPayload> | null
): ElevenLabsCredentialPayload | null {
  const apiKey = payload?.apiKey?.trim() ?? "";
  if (!apiKey) return null;
  return { apiKey };
}

function parseProvider<P extends ProviderId>(
  provider: P,
  raw: unknown
): ProviderPayloadMap[P] | null {
  if (provider === "openai") return parseOpenAI(raw as Partial<OpenAICredentialPayload>) as ProviderPayloadMap[P] | null;
  if (provider === "telnyx") return parseTelnyx(raw as Partial<TelnyxCredentialPayload>) as ProviderPayloadMap[P] | null;
  return parseElevenLabs(raw as Partial<ElevenLabsCredentialPayload>) as ProviderPayloadMap[P] | null;
}

export async function hasTenantProviderCredential(
  tenantId: string,
  environment: string,
  provider: ProviderId
): Promise<boolean> {
  const raw = await readSecret(tenantSecretId(environment, tenantId, provider));
  return parseProvider(provider, raw) !== null;
}

export async function getTenantProviderCredential<P extends ProviderId>(
  tenantId: string,
  environment: string,
  provider: P
): Promise<ProviderPayloadMap[P] | null> {
  const raw = await readSecret(tenantSecretId(environment, tenantId, provider));
  return parseProvider(provider, raw);
}

export async function saveTenantProviderCredential<P extends ProviderId>(
  tenantId: string,
  environment: string,
  provider: P,
  payload: ProviderPayloadMap[P]
): Promise<void> {
  await writeSecret(tenantSecretId(environment, tenantId, provider), payload);
}

export async function deleteTenantProviderCredential(
  tenantId: string,
  environment: string,
  provider: ProviderId
): Promise<void> {
  await removeSecret(tenantSecretId(environment, tenantId, provider));
}

export async function getPlatformProviderCredential<P extends ProviderId>(
  environment: string,
  provider: P
): Promise<ProviderPayloadMap[P] | null> {
  const raw = await readSecret(platformSecretId(environment, provider));
  return parseProvider(provider, raw);
}

async function resolveChain(
  tenantId: string
): Promise<Array<{ tenantId: string; source: Exclude<CredentialSource, "none" | "platform"> }>> {
  const chain: Array<{ tenantId: string; source: Exclude<CredentialSource, "none" | "platform"> }> = [
    { tenantId, source: "own" },
  ];

  const tenant = await getTenant(tenantId);
  if (tenant?.parentTenantId) {
    chain.push({ tenantId: tenant.parentTenantId, source: "reseller" });
  }

  return chain;
}

export async function resolveProviderCredential<P extends ProviderId>(
  tenantId: string,
  environment: string,
  provider: P
): Promise<ResolvedCredential<ProviderPayloadMap[P]> | null> {
  for (const entry of await resolveChain(tenantId)) {
    const payload = await getTenantProviderCredential(entry.tenantId, environment, provider);
    if (payload) {
      return {
        payload,
        source: entry.source,
        ownerTenantId: entry.tenantId,
      };
    }
  }

  const platformPayload = await getPlatformProviderCredential(environment, provider);
  if (platformPayload) {
    return {
      payload: platformPayload,
      source: "platform",
      ownerTenantId: "platform",
    };
  }

  return null;
}

export async function resolveOpenAIApiKey(
  tenantId: string,
  environment: string
): Promise<string> {
  const resolved = await resolveProviderCredential(tenantId, environment, "openai");
  if (!resolved) {
    const envKey = process.env.OPENAI_API_KEY?.trim();
    if (envKey) return envKey;
    throw new Error("No OpenAI API key configured");
  }
  return resolved.payload.apiKey;
}

export async function resolveTelnyxSecrets(
  tenantId: string,
  environment: string
): Promise<ResolvedCredential<TelnyxCredentialPayload>> {
  const resolved = await resolveProviderCredential(tenantId, environment, "telnyx");
  if (!resolved) {
    throw Object.assign(
      new Error(
        `Telnyx is not configured for tenant ${tenantId}. Configure credentials in account settings.`
      ),
      { statusCode: 400 }
    );
  }
  return resolved;
}

export async function resolveElevenLabsSecrets(
  tenantId: string,
  environment: string
): Promise<ResolvedCredential<ElevenLabsCredentialPayload>> {
  const resolved = await resolveProviderCredential(tenantId, environment, "elevenlabs");
  if (!resolved) {
    throw Object.assign(
      new Error(
        `ElevenLabs is not configured for tenant ${tenantId}. Configure credentials in account settings.`
      ),
      { statusCode: 400 }
    );
  }
  return resolved;
}

export async function hasResolvedTelnyxCredentials(
  tenantId: string,
  environment: string
): Promise<boolean> {
  try {
    await resolveTelnyxSecrets(tenantId, environment);
    return true;
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 400) return false;
    throw error;
  }
}

function telnyxWebhookPath(ownerTenantId: string, apiBaseUrl: string): string | undefined {
  if (!apiBaseUrl) return undefined;
  const base = apiBaseUrl.replace(/\/$/, "");
  if (ownerTenantId === "platform") return `${base}/telephony/webhook`;
  return `${base}/telephony/webhook/${ownerTenantId}`;
}

export async function getProviderCredentialStatuses(
  tenantId: string,
  environment: string,
  apiBaseUrl?: string
): Promise<ProviderCredentialStatus[]> {
  const providers: ProviderId[] = ["openai", "telnyx", "elevenlabs"];
  const ownFlags = await Promise.all(
    providers.map((provider) => hasTenantProviderCredential(tenantId, environment, provider))
  );

  const statuses: ProviderCredentialStatus[] = [];
  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i]!;
    const own = ownFlags[i]!;
    if (own) {
      const webhookUrl =
        provider === "telnyx" && apiBaseUrl ? telnyxWebhookPath(tenantId, apiBaseUrl) : undefined;
      statuses.push({
        provider,
        configured: true,
        source: "own",
        ownerTenantId: tenantId,
        ...(webhookUrl ? { webhookUrl } : {}),
      });
      continue;
    }

    const resolved = await resolveProviderCredential(tenantId, environment, provider);
    if (!resolved) {
      statuses.push({ provider, configured: false, source: "none" });
      continue;
    }

    const webhookUrl =
      provider === "telnyx" && apiBaseUrl
        ? telnyxWebhookPath(resolved.ownerTenantId, apiBaseUrl)
        : undefined;
    statuses.push({
      provider,
      configured: true,
      source: resolved.source,
      ownerTenantId: resolved.ownerTenantId,
      ...(webhookUrl ? { webhookUrl } : {}),
    });
  }

  return statuses;
}
