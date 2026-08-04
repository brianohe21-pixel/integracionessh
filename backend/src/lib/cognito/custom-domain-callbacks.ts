import {
  CognitoIdentityProviderClient,
  DescribeUserPoolClientCommand,
  UpdateUserPoolClientCommand,
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

export async function addCustomDomainToCognitoClient(domain: string): Promise<void> {
  const client = new CognitoIdentityProviderClient({});
  const userPoolId = getPoolId();
  const clientId = getClientId();
  const origin = normalizeOrigin(domain);
  const callback = `${origin}/api/auth/callback/cognito`;

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

  const callbackUrls = Array.from(
    new Set([...(current.CallbackURLs ?? []), callback])
  );
  const logoutUrls = Array.from(new Set([...(current.LogoutURLs ?? []), origin]));

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
      LogoutURLs: logoutUrls,
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
