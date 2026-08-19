import {
  deleteTenantProviderCredential,
  hasTenantProviderCredential,
  saveTenantProviderCredential,
} from "../integrations/provider-credentials.js";

export async function saveOpenAIApiKey(
  tenantId: string,
  environment: string,
  apiKey: string
): Promise<void> {
  await saveTenantProviderCredential(tenantId, environment, "openai", { apiKey });
}

export async function deleteOpenAIApiKey(
  tenantId: string,
  environment: string
): Promise<void> {
  await deleteTenantProviderCredential(tenantId, environment, "openai");
}

export async function hasOpenAIApiKey(
  tenantId: string,
  environment: string
): Promise<boolean> {
  return hasTenantProviderCredential(tenantId, environment, "openai");
}
