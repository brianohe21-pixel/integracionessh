import {
  AdminDisableUserCommand,
  AdminDeleteUserCommand,
  AdminEnableUserCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
  type AttributeType,
} from "@aws-sdk/client-cognito-identity-provider";

export interface CognitoUserSummary {
  username: string;
  sub: string;
  email: string;
  tenantId: string;
  role: string;
  enabled: boolean;
  createdAt: string;
}

function getUserPoolId(): string {
  const poolId = process.env.COGNITO_USER_POOL_ID?.trim();
  if (!poolId) {
    throw new Error("COGNITO_USER_POOL_ID is not configured");
  }
  return poolId;
}

function attrValue(attrs: AttributeType[] | undefined, name: string): string {
  return attrs?.find((a) => a.Name === name)?.Value?.trim() ?? "";
}

function mapUser(
  username: string,
  enabled: boolean,
  createdAt: Date | undefined,
  attrs: AttributeType[] | undefined
): CognitoUserSummary {
  return {
    username,
    sub: attrValue(attrs, "sub"),
    email: attrValue(attrs, "email"),
    tenantId: attrValue(attrs, "custom:tenantId"),
    role: attrValue(attrs, "custom:role") || "member",
    enabled,
    createdAt: createdAt?.toISOString() ?? "",
  };
}

export async function listCognitoUsers(
  limit: number,
  paginationToken?: string,
  role?: string
): Promise<{ users: CognitoUserSummary[]; paginationToken?: string }> {
  const client = new CognitoIdentityProviderClient({});
  const poolId = getUserPoolId();
  const target = Math.min(Math.max(limit, 1), 60);
  const roleFilter = role === "admin" || role === "member" ? role : undefined;

  const matched: CognitoUserSummary[] = [];
  let cognitoToken = paginationToken;

  while (matched.length < target) {
    const result = await client.send(
      new ListUsersCommand({
        UserPoolId: poolId,
        Limit: 60,
        PaginationToken: cognitoToken,
      })
    );

    for (const u of result.Users ?? []) {
      const summary = mapUser(
        u.Username ?? "",
        u.Enabled ?? false,
        u.UserCreateDate,
        u.Attributes
      );
      if (roleFilter && summary.role !== roleFilter) continue;
      matched.push(summary);
      if (matched.length >= target) break;
    }

    cognitoToken = result.PaginationToken;
    if (!cognitoToken) break;
  }

  return {
    users: matched,
    ...(cognitoToken ? { paginationToken: cognitoToken } : {}),
  };
}

export async function deleteCognitoUserBySub(sub: string): Promise<void> {
  const client = new CognitoIdentityProviderClient({});
  const poolId = getUserPoolId();

  const result = await client.send(
    new ListUsersCommand({
      UserPoolId: poolId,
      Filter: `sub = "${sub}"`,
      Limit: 1,
    })
  );

  const username = result.Users?.[0]?.Username;
  if (!username) return;

  await client.send(
    new AdminDeleteUserCommand({ UserPoolId: poolId, Username: username })
  );
}

export async function disableCognitoUserBySub(sub: string): Promise<void> {
  const client = new CognitoIdentityProviderClient({});
  const poolId = getUserPoolId();

  const result = await client.send(
    new ListUsersCommand({
      UserPoolId: poolId,
      Filter: `sub = "${sub}"`,
      Limit: 1,
    })
  );

  const username = result.Users?.[0]?.Username;
  if (!username) return;

  await client.send(
    new AdminDisableUserCommand({ UserPoolId: poolId, Username: username })
  );
}

export async function updateCognitoUser(
  username: string,
  updates: { enabled?: boolean; tenantId?: string; role?: string }
): Promise<void> {
  const client = new CognitoIdentityProviderClient({});
  const poolId = getUserPoolId();

  if (updates.enabled === true) {
    await client.send(
      new AdminEnableUserCommand({ UserPoolId: poolId, Username: username })
    );
  } else if (updates.enabled === false) {
    await client.send(
      new AdminDisableUserCommand({ UserPoolId: poolId, Username: username })
    );
  }

  const userAttributes: AttributeType[] = [];
  if (updates.tenantId !== undefined) {
    userAttributes.push({ Name: "custom:tenantId", Value: updates.tenantId });
  }
  if (updates.role !== undefined) {
    userAttributes.push({ Name: "custom:role", Value: updates.role });
  }

  if (userAttributes.length > 0) {
    await client.send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: poolId,
        Username: username,
        UserAttributes: userAttributes,
      })
    );
  }
}
