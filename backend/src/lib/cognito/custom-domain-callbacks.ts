import {
  CognitoIdentityProviderClient,
  DescribeUserPoolClientCommand,
  UpdateUserPoolClientCommand,
  type UserPoolClientType,
} from "@aws-sdk/client-cognito-identity-provider";

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

function normalizeOrigin(domain: string): string {
  const host = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `https://${host}`;
}

function urlsForDomain(domain: string): { origin: string; callback: string } {
  const origin = normalizeOrigin(domain);
  return { origin, callback: `${origin}/api/auth/callback/cognito` };
}

async function updateCognitoClientUrls(
  nextUrls: (current: UserPoolClientType) => {
    callbackUrls: string[];
    logoutUrls: string[];
  }
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

  const { callbackUrls, logoutUrls } = nextUrls(current);
  if (callbackUrls.length === 0) return;

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
      SupportedIdentityProviders: current.SupportedIdentityProviders,
      CallbackURLs: callbackUrls,
      LogoutURLs: logoutUrls.length > 0 ? logoutUrls : current.LogoutURLs,
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

export async function addCustomDomainToCognitoClient(domain: string): Promise<void> {
  const { origin, callback } = urlsForDomain(domain);
  await updateCognitoClientUrls((current) => ({
    callbackUrls: Array.from(new Set([...(current.CallbackURLs ?? []), callback])),
    logoutUrls: Array.from(new Set([...(current.LogoutURLs ?? []), origin])),
  }));
}

export async function removeCustomDomainFromCognitoClient(domain: string): Promise<void> {
  const { origin, callback } = urlsForDomain(domain);
  await updateCognitoClientUrls((current) => ({
    callbackUrls: (current.CallbackURLs ?? []).filter((url) => url !== callback),
    logoutUrls: (current.LogoutURLs ?? []).filter((url) => url !== origin),
  }));
}
