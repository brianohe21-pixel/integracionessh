import {
  CognitoIdentityProviderClient,
  CreateIdentityProviderCommand,
  UpdateIdentityProviderCommand,
  DeleteIdentityProviderCommand,
  DescribeIdentityProviderCommand,
  DescribeUserPoolClientCommand,
  UpdateUserPoolClientCommand,
  type UserPoolClientType,
} from "@aws-sdk/client-cognito-identity-provider";
import type { MicrosoftSsoConfig } from "../dynamodb/microsoft-sso.repository.js";
import { getMicrosoftSsoClientSecret } from "../integrations/microsoft-sso-secrets.js";
import { buildOidcIssuer } from "../integrations/microsoft-sso.validation.js";

function getPoolId(): string {
  const poolId = process.env.COGNITO_USER_POOL_ID?.trim();
  if (!poolId) {
    throw Object.assign(new Error("COGNITO_USER_POOL_ID is not configured"), {
      statusCode: 500,
    });
  }
  return poolId;
}

function getClientId(): string {
  const clientId = process.env.COGNITO_CLIENT_ID?.trim();
  if (!clientId) {
    throw Object.assign(new Error("COGNITO_CLIENT_ID is not configured"), {
      statusCode: 500,
    });
  }
  return clientId;
}

function getHostedUiDomain(): string {
  const domain = process.env.COGNITO_HOSTED_UI_DOMAIN?.trim();
  if (!domain) {
    throw Object.assign(new Error("COGNITO_HOSTED_UI_DOMAIN is not configured"), {
      statusCode: 500,
    });
  }
  return domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function getCognitoSsoUrls() {
  const hostedDomain = getHostedUiDomain();
  const poolId = getPoolId();
  return {
    oidcRedirectUri: `https://${hostedDomain}/oauth2/idpresponse`,
    samlAcsUrl: `https://${hostedDomain}/saml2/idpresponse`,
    samlEntityId: `urn:amazon:cognito:sp:${poolId}`,
  };
}

async function updateSupportedProviders(
  mutate: (current: string[]) => string[]
): Promise<void> {
  const client = new CognitoIdentityProviderClient({});
  const userPoolId = getPoolId();
  const clientId = getClientId();

  const described = await client.send(
    new DescribeUserPoolClientCommand({
      UserPoolId: userPoolId,
      ClientId: clientId,
    })
  );

  const current = described.UserPoolClient;
  if (!current) {
    throw Object.assign(new Error("Cognito user pool client not found"), {
      statusCode: 500,
    });
  }

  const nextProviders = mutate(current.SupportedIdentityProviders ?? ["COGNITO"]);

  await client.send(
    new UpdateUserPoolClientCommand({
      UserPoolId: userPoolId,
      ClientId: clientId,
      ClientName: current.ClientName,
      RefreshTokenValidity: current.RefreshTokenValidity,
      AccessTokenValidity: current.AccessTokenValidity,
      IdTokenValidity: current.IdTokenValidity,
      TokenValidityUnits: current.TokenValidityUnits,
      ReadAttributes: current.ReadAttributes,
      WriteAttributes: current.WriteAttributes,
      ExplicitAuthFlows: current.ExplicitAuthFlows,
      SupportedIdentityProviders: nextProviders,
      CallbackURLs: current.CallbackURLs,
      LogoutURLs: current.LogoutURLs,
      AllowedOAuthFlows: current.AllowedOAuthFlows,
      AllowedOAuthScopes: current.AllowedOAuthScopes,
      AllowedOAuthFlowsUserPoolClient: current.AllowedOAuthFlowsUserPoolClient,
      PreventUserExistenceErrors: current.PreventUserExistenceErrors,
      EnableTokenRevocation: current.EnableTokenRevocation,
      EnablePropagateAdditionalUserContextData:
        current.EnablePropagateAdditionalUserContextData,
      AuthSessionValidity: current.AuthSessionValidity,
    })
  );
}

async function providerExists(providerName: string): Promise<boolean> {
  const client = new CognitoIdentityProviderClient({});
  try {
    await client.send(
      new DescribeIdentityProviderCommand({
        UserPoolId: getPoolId(),
        ProviderName: providerName,
      })
    );
    return true;
  } catch {
    return false;
  }
}

export async function provisionMicrosoftSsoProvider(
  config: MicrosoftSsoConfig,
  environment: string
): Promise<void> {
  const client = new CognitoIdentityProviderClient({});
  const userPoolId = getPoolId();
  const providerName = config.cognitoProviderName;
  const exists = await providerExists(providerName);

  if (config.protocol === "oidc") {
    const entraTenantId = config.entraTenantId?.trim() ?? "";
    const clientId = config.clientId?.trim() ?? "";
    const clientSecret = await getMicrosoftSsoClientSecret(config.tenantId, environment);
    if (!entraTenantId || !clientId || !clientSecret) {
      throw Object.assign(new Error("Microsoft OIDC configuration is incomplete"), {
        statusCode: 400,
      });
    }

    const providerDetails = {
      oidc_issuer: buildOidcIssuer(entraTenantId),
      client_id: clientId,
      client_secret: clientSecret,
      authorize_scopes: "openid email profile",
      attributes_request_method: "GET",
    };
    const attributeMapping = {
      email: "email",
      name: "name",
      username: "sub",
    };

    if (exists) {
      await client.send(
        new UpdateIdentityProviderCommand({
          UserPoolId: userPoolId,
          ProviderName: providerName,
          ProviderDetails: providerDetails,
          AttributeMapping: attributeMapping,
        })
      );
    } else {
      await client.send(
        new CreateIdentityProviderCommand({
          UserPoolId: userPoolId,
          ProviderName: providerName,
          ProviderType: "OIDC",
          ProviderDetails: providerDetails,
          AttributeMapping: attributeMapping,
        })
      );
    }
  } else {
    const metadataUrl = config.metadataUrl?.trim() ?? "";
    if (!metadataUrl) {
      throw Object.assign(new Error("Microsoft SAML metadata URL is required"), {
        statusCode: 400,
      });
    }

    const providerDetails = {
      MetadataURL: metadataUrl,
      IDPSignout: "false",
    };
    const attributeMapping = {
      email:
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
      name: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
      username:
        "http://schemas.microsoft.com/identity/claims/objectidentifier",
    };

    if (exists) {
      await client.send(
        new UpdateIdentityProviderCommand({
          UserPoolId: userPoolId,
          ProviderName: providerName,
          ProviderDetails: providerDetails,
          AttributeMapping: attributeMapping,
        })
      );
    } else {
      await client.send(
        new CreateIdentityProviderCommand({
          UserPoolId: userPoolId,
          ProviderName: providerName,
          ProviderType: "SAML",
          ProviderDetails: providerDetails,
          AttributeMapping: attributeMapping,
        })
      );
    }
  }

  await updateSupportedProviders((current) =>
    Array.from(new Set([...current, providerName]))
  );
}

export async function removeMicrosoftSsoProvider(providerName: string): Promise<void> {
  const client = new CognitoIdentityProviderClient({});
  const exists = await providerExists(providerName);
  if (exists) {
    await client.send(
      new DeleteIdentityProviderCommand({
        UserPoolId: getPoolId(),
        ProviderName: providerName,
      })
    );
  }

  await updateSupportedProviders((current) =>
    current.filter((provider) => provider !== providerName)
  );
}

export function preserveClientSettings(current: UserPoolClientType) {
  return current;
}
