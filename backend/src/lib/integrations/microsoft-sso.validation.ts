export function buildOidcIssuer(entraTenantId: string): string {
  return `https://login.microsoftonline.com/${entraTenantId.trim()}/v2.0`;
}

export function buildSamlMetadataUrl(entraTenantId: string): string {
  return `https://login.microsoftonline.com/${entraTenantId.trim()}/federationmetadata/2007-06/federationmetadata.xml`;
}

export async function validateOidcConfiguration(params: {
  entraTenantId: string;
  clientId: string;
  clientSecret: string;
}): Promise<void> {
  const issuer = buildOidcIssuer(params.entraTenantId);
  const discoveryUrl = `${issuer}/.well-known/openid-configuration`;
  const response = await fetch(discoveryUrl, { method: "GET" });
  if (!response.ok) {
    throw Object.assign(new Error("Microsoft OIDC discovery endpoint is unreachable"), {
      statusCode: 400,
    });
  }
  const discovery = (await response.json()) as { token_endpoint?: string };
  if (!discovery.token_endpoint) {
    throw Object.assign(new Error("Invalid Microsoft OIDC discovery document"), {
      statusCode: 400,
    });
  }

  const body = new URLSearchParams({
    client_id: params.clientId.trim(),
    client_secret: params.clientSecret.trim(),
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const tokenResponse = await fetch(discovery.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!tokenResponse.ok) {
    throw Object.assign(
      new Error("Microsoft OIDC credentials are invalid or lack required permissions"),
      { statusCode: 400 }
    );
  }
}

export async function validateSamlMetadataUrl(metadataUrl: string): Promise<void> {
  const response = await fetch(metadataUrl.trim(), { method: "GET" });
  if (!response.ok) {
    throw Object.assign(new Error("Microsoft SAML metadata URL is unreachable"), {
      statusCode: 400,
    });
  }
  const text = await response.text();
  if (!text.includes("EntityDescriptor") || !text.includes("IDPSSODescriptor")) {
    throw Object.assign(new Error("Invalid Microsoft SAML metadata document"), {
      statusCode: 400,
    });
  }
}
