import type { MetaAppCredentialPayload } from "./meta-app-credentials.js";
import { generateWebhookVerifyToken } from "./meta-app-credentials.js";

export interface MetaAppCredentialInput {
  appId?: string;
  appSecret?: string;
  embeddedSignupConfigId?: string;
}

export function normalizeMetaAppPayload(
  input: MetaAppCredentialInput,
  existing?: MetaAppCredentialPayload | null
): MetaAppCredentialPayload {
  const appId = (input.appId ?? existing?.appId ?? "").trim();
  const appSecret = (input.appSecret ?? existing?.appSecret ?? "").trim();
  const embeddedSignupConfigId = (
    input.embeddedSignupConfigId ?? existing?.embeddedSignupConfigId ?? ""
  ).trim();
  const webhookVerifyToken = existing?.webhookVerifyToken?.trim() || generateWebhookVerifyToken();

  if (!/^\d+$/.test(appId)) {
    throw Object.assign(new Error("Meta App ID must be numeric"), { statusCode: 400 });
  }
  if (appSecret.length < 16) {
    throw Object.assign(new Error("Meta App Secret is required"), { statusCode: 400 });
  }
  if (!embeddedSignupConfigId) {
    throw Object.assign(
      new Error("Embedded Signup Configuration ID is required"),
      { statusCode: 400 }
    );
  }

  return { appId, appSecret, embeddedSignupConfigId, webhookVerifyToken };
}
