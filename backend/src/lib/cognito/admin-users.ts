import {
  AdminDisableUserCommand,
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
  paginationToken?: string
): Promise<{ users: CognitoUserSummary[]; paginationToken?: string }> {
  const client = new CognitoIdentityProviderClient({});
  const result = await client.send(
    new ListUsersCommand({
      UserPoolId: getUserPoolId(),
      Limit: Math.min(Math.max(limit, 1), 60),
      PaginationToken: paginationToken,
    })
  );

  const users = (result.Users ?? []).map((u) =>
    mapUser(u.Username ?? "", u.Enabled ?? false, u.UserCreateDate, u.Attributes)
  );

  return {
    users,
    ...(result.PaginationToken ? { paginationToken: result.PaginationToken } : {}),
  };
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
