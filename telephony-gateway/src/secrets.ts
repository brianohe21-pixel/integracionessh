import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { docClient, tableName } from "./dynamo.js";

function environmentName(): string {
  return process.env.ENVIRONMENT ?? "dev";
}

type ProviderId = "openai" | "elevenlabs" | "deepgram";

async function readSecret(secretId: string): Promise<Record<string, string> | null> {
  const client = new SecretsManagerClient({ region: process.env.AWS_REGION ?? "us-east-1" });
  try {
    const response = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
    return JSON.parse(response.SecretString ?? "{}") as Record<string, string>;
  } catch {
    return null;
  }
}

async function getParentTenantId(tenantId: string): Promise<string | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: `TENANT#${tenantId}`,
        SK: "METADATA",
      },
    })
  );
  const parentTenantId = result.Item?.parentTenantId;
  return typeof parentTenantId === "string" ? parentTenantId : null;
}

async function resolveApiKey(tenantId: string, provider: ProviderId): Promise<string> {
  const chain = [tenantId];
  const parentTenantId = await getParentTenantId(tenantId);
  if (parentTenantId) chain.push(parentTenantId);

  for (const ownerId of chain) {
    const secret = await readSecret(`/${environmentName()}/tenants/${ownerId}/${provider}`);
    const apiKey = secret?.apiKey?.trim();
    if (apiKey) return apiKey;
  }

  const platform = await readSecret(`/${environmentName()}/platform/${provider}`);
  const platformKey = platform?.apiKey?.trim();
  if (platformKey) return platformKey;

  throw new Error(`${provider} apiKey is not configured`);
}

export async function getOpenAIApiKey(tenantId: string): Promise<string> {
  return resolveApiKey(tenantId, "openai");
}

export async function getElevenLabsApiKey(tenantId: string): Promise<string> {
  return resolveApiKey(tenantId, "elevenlabs");
}

export async function getDeepgramApiKey(tenantId: string): Promise<string> {
  return resolveApiKey(tenantId, "deepgram");
}
