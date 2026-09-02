import { getTenant, getTenantIdByDomain, normalizeDomain } from "../dynamodb/tenant.repository.js";
import {
  buildMicrosoftProviderName,
  deleteMicrosoftSsoConfig,
  getMicrosoftSsoConfig,
  putMicrosoftSsoConfig,
  type MicrosoftSsoConfig,
  type MicrosoftSsoProtocol,
} from "../dynamodb/microsoft-sso.repository.js";
import {
  deleteMicrosoftSsoClientSecret,
  getMicrosoftSsoClientSecret,
  maskClientSecret,
  saveMicrosoftSsoClientSecret,
} from "./microsoft-sso-secrets.js";
import {
  buildSamlMetadataUrl,
  validateOidcConfiguration,
  validateSamlMetadataUrl,
} from "./microsoft-sso.validation.js";
import {
  getCognitoSsoUrls,
  provisionMicrosoftSsoProvider,
  removeMicrosoftSsoProvider,
} from "../cognito/entra-sso.service.js";
import { getGoogleBusinessCatalogItem } from "../google-business/service.js";

export interface MicrosoftSsoPublicView {
  id: "microsoft-sso";
  configured: boolean;
  enabled: boolean;
  protocol?: MicrosoftSsoProtocol;
  status?: MicrosoftSsoConfig["status"];
  entraTenantId?: string;
  clientId?: string;
  clientSecretMasked?: string;
  metadataUrl?: string;
  allowedDomains?: string[];
  enforceSso?: boolean;
  cognitoProviderName?: string;
  redirectUri?: string;
  samlAcsUrl?: string;
  samlEntityId?: string;
  appCallbackUrl?: string;
  lastTestedAt?: string;
  lastTestStatus?: "success" | "failed";
  lastTestMessage?: string;
}

export interface IntegrationCatalogItem {
  id: "microsoft-sso" | "google-business-profile";
  configured: boolean;
  enabled: boolean;
  status?: MicrosoftSsoConfig["status"] | "pending" | "active" | "error";
}

function normalizeDomains(domains: string[] | undefined): string[] {
  if (!domains?.length) return [];
  return Array.from(
    new Set(
      domains
        .map((domain) => domain.trim().toLowerCase().replace(/^@/, ""))
        .filter(Boolean)
    )
  );
}

function resolveAppCallbackUrl(tenant: Awaited<ReturnType<typeof getTenant>>) {
  const customDomain = tenant?.resellerConfig?.customDomain?.trim();
  if (!customDomain) return undefined;
  const host = customDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `https://${host}/api/auth/callback/cognito`;
}

function toPublicView(
  config: MicrosoftSsoConfig | null,
  tenant: Awaited<ReturnType<typeof getTenant>>,
  clientSecretMasked?: string
): MicrosoftSsoPublicView {
  const urls = getCognitoSsoUrls();
  const appCallbackUrl = resolveAppCallbackUrl(tenant);
  if (!config) {
    return {
      id: "microsoft-sso",
      configured: false,
      enabled: false,
      redirectUri: urls.oidcRedirectUri,
      samlAcsUrl: urls.samlAcsUrl,
      samlEntityId: urls.samlEntityId,
      ...(appCallbackUrl ? { appCallbackUrl } : {}),
    };
  }

  return {
    id: "microsoft-sso",
    configured: config.status === "active",
    enabled: config.enabled,
    ...(config.protocol ? { protocol: config.protocol } : {}),
    ...(config.status ? { status: config.status } : {}),
    ...(config.entraTenantId ? { entraTenantId: config.entraTenantId } : {}),
    ...(config.clientId ? { clientId: config.clientId } : {}),
    ...(clientSecretMasked ? { clientSecretMasked } : {}),
    ...(config.metadataUrl ? { metadataUrl: config.metadataUrl } : {}),
    ...(config.allowedDomains?.length ? { allowedDomains: config.allowedDomains } : {}),
    ...(config.enforceSso !== undefined ? { enforceSso: config.enforceSso } : {}),
    ...(config.cognitoProviderName ? { cognitoProviderName: config.cognitoProviderName } : {}),
    redirectUri: urls.oidcRedirectUri,
    samlAcsUrl: urls.samlAcsUrl,
    samlEntityId: urls.samlEntityId,
    ...(appCallbackUrl ? { appCallbackUrl } : {}),
    ...(config.lastTestedAt ? { lastTestedAt: config.lastTestedAt } : {}),
    ...(config.lastTestStatus ? { lastTestStatus: config.lastTestStatus } : {}),
    ...(config.lastTestMessage ? { lastTestMessage: config.lastTestMessage } : {}),
  };
}

export async function getIntegrationCatalog(
  tenantId: string
): Promise<{ items: IntegrationCatalogItem[] }> {
  const [config, googleBusiness] = await Promise.all([
    getMicrosoftSsoConfig(tenantId),
    getGoogleBusinessCatalogItem(tenantId),
  ]);
  return {
    items: [
      {
        id: "microsoft-sso",
        configured: config?.status === "active",
        enabled: Boolean(config?.enabled),
        ...(config?.status ? { status: config.status } : {}),
      },
      googleBusiness,
    ],
  };
}

export async function getMicrosoftSsoView(tenantId: string): Promise<MicrosoftSsoPublicView> {
  const [config, tenant, secret] = await Promise.all([
    getMicrosoftSsoConfig(tenantId),
    getTenant(tenantId),
    getMicrosoftSsoClientSecret(tenantId, process.env.ENVIRONMENT ?? "dev"),
  ]);
  const masked = secret ? maskClientSecret(secret) : undefined;
  return toPublicView(config, tenant, masked);
}

export async function saveMicrosoftSsoConfiguration(params: {
  tenantId: string;
  environment: string;
  protocol: MicrosoftSsoProtocol;
  enabled?: boolean;
  entraTenantId?: string;
  clientId?: string;
  clientSecret?: string;
  metadataUrl?: string;
  allowedDomains?: string[];
  enforceSso?: boolean;
}): Promise<MicrosoftSsoPublicView> {
  const tenant = await getTenant(params.tenantId);
  if (!tenant) {
    throw Object.assign(new Error("Tenant not found"), { statusCode: 404 });
  }

  const existing = await getMicrosoftSsoConfig(params.tenantId);
  const now = new Date().toISOString();
  const providerName =
    existing?.cognitoProviderName ?? buildMicrosoftProviderName(params.tenantId);

  const allowedDomains = normalizeDomains(params.allowedDomains);
  const entraTenantId = params.entraTenantId?.trim() ?? existing?.entraTenantId?.trim() ?? "";
  const clientId = params.clientId?.trim() ?? existing?.clientId?.trim() ?? "";
  const incomingSecret = params.clientSecret?.trim() ?? "";
  const storedSecret =
    incomingSecret ||
    (await getMicrosoftSsoClientSecret(params.tenantId, params.environment)) ||
    "";

  if (params.protocol === "oidc") {
    if (!entraTenantId || !clientId) {
      throw Object.assign(new Error("Tenant ID and Client ID are required for OIDC"), {
        statusCode: 400,
      });
    }
    if (!storedSecret) {
      throw Object.assign(new Error("Client secret is required for OIDC"), {
        statusCode: 400,
      });
    }
    await validateOidcConfiguration({
      entraTenantId,
      clientId,
      clientSecret: storedSecret,
    });
    if (incomingSecret) {
      await saveMicrosoftSsoClientSecret(params.tenantId, params.environment, incomingSecret);
    }
  } else {
    const metadataUrl =
      params.metadataUrl?.trim() ||
      existing?.metadataUrl?.trim() ||
      (entraTenantId ? buildSamlMetadataUrl(entraTenantId) : "");
    if (!metadataUrl) {
      throw Object.assign(new Error("SAML metadata URL or Tenant ID is required"), {
        statusCode: 400,
      });
    }
    await validateSamlMetadataUrl(metadataUrl);
    params.metadataUrl = metadataUrl;
  }

  const config: MicrosoftSsoConfig = {
    tenantId: params.tenantId,
    protocol: params.protocol,
    enabled: params.enabled ?? existing?.enabled ?? false,
    status: "pending",
    cognitoProviderName: providerName,
    allowedDomains,
    enforceSso: params.enforceSso ?? existing?.enforceSso ?? false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    ...(params.protocol === "oidc"
      ? {
          entraTenantId,
          clientId,
        }
      : {
          metadataUrl: params.metadataUrl!,
          ...(entraTenantId ? { entraTenantId } : {}),
        }),
  };

  await putMicrosoftSsoConfig(config);
  await provisionMicrosoftSsoProvider(config, params.environment);

  const activeConfig: MicrosoftSsoConfig = {
    ...config,
    status: "active",
    lastTestedAt: now,
    lastTestStatus: "success",
  };
  await putMicrosoftSsoConfig(activeConfig);

  const secret = await getMicrosoftSsoClientSecret(params.tenantId, params.environment);
  return toPublicView(
    activeConfig,
    tenant,
    secret ? maskClientSecret(secret) : undefined
  );
}

export async function testMicrosoftSsoConfiguration(
  tenantId: string,
  environment: string
): Promise<MicrosoftSsoPublicView> {
  const config = await getMicrosoftSsoConfig(tenantId);
  if (!config) {
    throw Object.assign(new Error("Microsoft SSO is not configured"), { statusCode: 400 });
  }

  const now = new Date().toISOString();
  try {
    if (config.protocol === "oidc") {
      const clientSecret = await getMicrosoftSsoClientSecret(tenantId, environment);
      if (!config.entraTenantId || !config.clientId || !clientSecret) {
        throw new Error("OIDC configuration is incomplete");
      }
      await validateOidcConfiguration({
        entraTenantId: config.entraTenantId,
        clientId: config.clientId,
        clientSecret,
      });
    } else {
      const metadataUrl = config.metadataUrl?.trim() ?? "";
      if (!metadataUrl) throw new Error("SAML metadata URL is missing");
      await validateSamlMetadataUrl(metadataUrl);
    }

    await provisionMicrosoftSsoProvider(config, environment);
    const updated: MicrosoftSsoConfig = {
      ...config,
      status: "active",
      lastTestedAt: now,
      lastTestStatus: "success",
      updatedAt: now,
    };
    await putMicrosoftSsoConfig(updated);
    const tenant = await getTenant(tenantId);
    const secret = await getMicrosoftSsoClientSecret(tenantId, environment);
    return toPublicView(
      updated,
      tenant,
      secret ? maskClientSecret(secret) : undefined
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection test failed";
    const updated: MicrosoftSsoConfig = {
      ...config,
      status: "error",
      lastTestedAt: now,
      lastTestStatus: "failed",
      lastTestMessage: message,
      updatedAt: now,
    };
    await putMicrosoftSsoConfig(updated);
    throw Object.assign(new Error(message), { statusCode: 400 });
  }
}

export async function updateMicrosoftSsoEnabled(
  tenantId: string,
  enabled: boolean,
  environment: string
): Promise<MicrosoftSsoPublicView> {
  const config = await getMicrosoftSsoConfig(tenantId);
  if (!config || config.status !== "active") {
    throw Object.assign(new Error("Configure and test Microsoft SSO before enabling it"), {
      statusCode: 400,
    });
  }

  const updated: MicrosoftSsoConfig = {
    ...config,
    enabled,
    updatedAt: new Date().toISOString(),
  };
  await putMicrosoftSsoConfig(updated);
  if (enabled) {
    await provisionMicrosoftSsoProvider(updated, environment);
  }

  const tenant = await getTenant(tenantId);
  const secret = await getMicrosoftSsoClientSecret(tenantId, environment);
  return toPublicView(
    updated,
    tenant,
    secret ? maskClientSecret(secret) : undefined
  );
}

export async function deleteMicrosoftSsoConfiguration(
  tenantId: string,
  environment: string
): Promise<MicrosoftSsoPublicView> {
  const config = await getMicrosoftSsoConfig(tenantId);
  if (config?.cognitoProviderName) {
    await removeMicrosoftSsoProvider(config.cognitoProviderName);
  }
  await deleteMicrosoftSsoClientSecret(tenantId, environment);
  await deleteMicrosoftSsoConfig(tenantId, config?.cognitoProviderName);
  const tenant = await getTenant(tenantId);
  return toPublicView(null, tenant);
}

export async function getPublicAuthMethodsByHost(host: string): Promise<{
  password: boolean;
  google: boolean;
  microsoft: {
    enabled: boolean;
    providerName: string;
    enforceSso: boolean;
  } | null;
}> {
  const normalizedHost = normalizeDomain(host);
  const tenantId = await getTenantIdByDomain(normalizedHost);
  if (!tenantId) {
    return { password: true, google: false, microsoft: null };
  }

  const tenant = await getTenant(tenantId);
  if (
    !tenant ||
    tenant.status === "suspended" ||
    tenant.resellerConfig?.customDomainStatus !== "active"
  ) {
    return { password: true, google: false, microsoft: null };
  }

  const config = await getMicrosoftSsoConfig(tenantId);
  if (!config || config.status !== "active" || !config.enabled) {
    return {
      password: !config?.enforceSso,
      google: false,
      microsoft: null,
    };
  }

  return {
    password: !config.enforceSso,
    google: false,
    microsoft: {
      enabled: true,
      providerName: config.cognitoProviderName,
      enforceSso: Boolean(config.enforceSso),
    },
  };
}
