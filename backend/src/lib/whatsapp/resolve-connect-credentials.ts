import { resolveMetaAppCredential } from "../integrations/meta-app-credentials.js";

export interface WhatsAppConnectCredentials {
  appId: string;
  appSecret: string;
  platformAppSecret: string;
  metaAppOwnerTenantId: string;
  source: "own" | "reseller" | "platform";
}

export async function resolveWhatsAppConnectCredentials(
  tenantId: string,
  environment: string
): Promise<WhatsAppConnectCredentials> {
  const resolved = await resolveMetaAppCredential(tenantId, environment);
  if (!resolved) {
    throw Object.assign(
      new Error("WhatsApp embedded signup is not configured on the server"),
      { statusCode: 400, code: "META_APP_NOT_CONFIGURED" }
    );
  }

  return {
    appId: resolved.payload.appId,
    appSecret: resolved.payload.appSecret,
    platformAppSecret: resolved.payload.appSecret,
    metaAppOwnerTenantId: resolved.ownerTenantId,
    source: resolved.source,
  };
}
