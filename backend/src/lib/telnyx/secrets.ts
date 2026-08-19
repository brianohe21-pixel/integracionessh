import type { TelnyxSecretPayload, ElevenLabsSecretPayload } from "./secrets.types.js";
import {
  getPlatformProviderCredential,
  resolveElevenLabsSecrets,
  resolveTelnyxSecrets,
  hasResolvedTelnyxCredentials,
} from "../integrations/provider-credentials.js";

export type { TelnyxSecretPayload, ElevenLabsSecretPayload };

export async function getTelnyxSecrets(
  environment: string,
  tenantId?: string
): Promise<TelnyxSecretPayload> {
  if (tenantId) {
    const resolved = await resolveTelnyxSecrets(tenantId, environment);
    return resolved.payload;
  }

  const platform = await getPlatformProviderCredential(environment, "telnyx");
  if (!platform) {
    throw Object.assign(
      new Error(
        `Telnyx is not configured. Create secret /${environment}/platform/telnyx with {"apiKey":"...","connectionId":"...","publicKey":"..."}.`
      ),
      { statusCode: 400 }
    );
  }
  return platform;
}

export async function getElevenLabsSecrets(
  environment: string,
  tenantId?: string
): Promise<ElevenLabsSecretPayload> {
  if (tenantId) {
    const resolved = await resolveElevenLabsSecrets(tenantId, environment);
    return resolved.payload;
  }

  const platform = await getPlatformProviderCredential(environment, "elevenlabs");
  if (!platform) {
    throw Object.assign(
      new Error(`ElevenLabs is not configured. Create secret /${environment}/platform/elevenlabs.`),
      { statusCode: 400 }
    );
  }
  return platform;
}

export async function hasTelnyxCredentials(
  environment: string,
  tenantId?: string
): Promise<boolean> {
  if (tenantId) {
    return hasResolvedTelnyxCredentials(tenantId, environment);
  }
  try {
    await getTelnyxSecrets(environment);
    return true;
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 400) return false;
    throw error;
  }
}
