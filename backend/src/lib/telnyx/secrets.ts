import {
  SecretsManagerClient,
  GetSecretValueCommand,
  ResourceNotFoundException,
} from "@aws-sdk/client-secrets-manager";

export interface TelnyxSecretPayload {
  apiKey: string;
  publicKey?: string;
  connectionId: string;
}

export interface ElevenLabsSecretPayload {
  apiKey: string;
}

function telnyxSecretId(environment: string): string {
  return `/${environment}/platform/telnyx`;
}

function elevenLabsSecretId(environment: string): string {
  return `/${environment}/platform/elevenlabs`;
}

export async function getTelnyxSecrets(environment: string): Promise<TelnyxSecretPayload> {
  const client = new SecretsManagerClient({});
  const id = telnyxSecretId(environment);
  try {
    const response = await client.send(new GetSecretValueCommand({ SecretId: id }));
    const parsed = JSON.parse(response.SecretString ?? "{}") as Partial<TelnyxSecretPayload>;
    const apiKey = parsed.apiKey?.trim() ?? "";
    const connectionId = parsed.connectionId?.trim() ?? "";
    if (!apiKey || !connectionId) {
      throw Object.assign(
        new Error(
          `Telnyx credentials are incomplete. Set apiKey and connectionId in secret ${id}.`
        ),
        { statusCode: 400 }
      );
    }
    return {
      apiKey,
      connectionId,
      ...(parsed.publicKey?.trim() ? { publicKey: parsed.publicKey.trim() } : {}),
    };
  } catch (error) {
    if (error instanceof ResourceNotFoundException) {
      throw Object.assign(
        new Error(
          `Telnyx is not configured. Create secret ${id} with {"apiKey":"...","connectionId":"...","publicKey":"..."}.`
        ),
        { statusCode: 400 }
      );
    }
    throw error;
  }
}

export async function getElevenLabsSecrets(environment: string): Promise<ElevenLabsSecretPayload> {
  const client = new SecretsManagerClient({});
  const id = elevenLabsSecretId(environment);
  try {
    const response = await client.send(new GetSecretValueCommand({ SecretId: id }));
    const parsed = JSON.parse(response.SecretString ?? "{}") as Partial<ElevenLabsSecretPayload>;
    const apiKey = parsed.apiKey?.trim() ?? "";
    if (!apiKey) {
      throw Object.assign(
        new Error(`ElevenLabs credentials are incomplete. Set apiKey in secret ${id}.`),
        { statusCode: 400 }
      );
    }
    return { apiKey };
  } catch (error) {
    if (error instanceof ResourceNotFoundException) {
      throw Object.assign(
        new Error(`ElevenLabs is not configured. Create secret ${id} with {"apiKey":"..."}.`),
        { statusCode: 400 }
      );
    }
    throw error;
  }
}

export async function hasTelnyxCredentials(environment: string): Promise<boolean> {
  try {
    await getTelnyxSecrets(environment);
    return true;
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 400) return false;
    throw error;
  }
}
