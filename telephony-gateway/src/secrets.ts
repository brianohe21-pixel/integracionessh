import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const environment = process.env.ENVIRONMENT ?? "dev";

export async function getElevenLabsSecrets(): Promise<{ apiKey: string }> {
  const client = new SecretsManagerClient({ region: process.env.AWS_REGION ?? "us-east-1" });
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: `/${environment}/platform/elevenlabs` })
  );
  const parsed = JSON.parse(response.SecretString ?? "{}") as { apiKey?: string };
  const apiKey = parsed.apiKey?.trim() ?? "";
  if (!apiKey) throw new Error("ElevenLabs apiKey is not configured");
  return { apiKey };
}

export async function getOpenAIApiKey(tenantId: string): Promise<string> {
  const client = new SecretsManagerClient({ region: process.env.AWS_REGION ?? "us-east-1" });
  const tenantSecretId = `/${environment}/tenants/${tenantId}/openai`;
  try {
    const response = await client.send(new GetSecretValueCommand({ SecretId: tenantSecretId }));
    const parsed = JSON.parse(response.SecretString ?? "{}") as { apiKey?: string };
    const apiKey = parsed.apiKey?.trim();
    if (apiKey) return apiKey;
  } catch {
    // fall through to platform secret
  }

  const platform = await client.send(
    new GetSecretValueCommand({ SecretId: `/${environment}/platform/openai` })
  );
  const parsed = JSON.parse(platform.SecretString ?? "{}") as { apiKey?: string };
  const apiKey = parsed.apiKey?.trim() ?? "";
  if (!apiKey) throw new Error("OpenAI apiKey is not configured");
  return apiKey;
}

export async function getElevenLabsApiKey(): Promise<string> {
  const secrets = await getElevenLabsSecrets();
  return secrets.apiKey;
}
