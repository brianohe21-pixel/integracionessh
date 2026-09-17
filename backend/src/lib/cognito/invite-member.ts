import {
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  UserNotFoundException,
  UsernameExistsException,
  type AttributeType,
} from "@aws-sdk/client-cognito-identity-provider";
import { randomBytes } from "crypto";

function getUserPoolId(): string {
  const poolId = process.env.COGNITO_USER_POOL_ID?.trim();
  if (!poolId) {
    const error = new Error("COGNITO_USER_POOL_ID is not configured");
    (error as Error & { statusCode: number }).statusCode = 500;
    throw error;
  }
  return poolId;
}

function attrValue(attrs: AttributeType[] | undefined, name: string): string {
  return attrs?.find((a) => a.Name === name)?.Value?.trim() ?? "";
}

function generateTemporaryPassword(): string {
  const base = randomBytes(12).toString("base64url");
  return `Aa1!${base}`;
}

function memberEmailTakenError(): Error {
  const err = new Error("A user with this email already exists");
  (err as Error & { statusCode: number }).statusCode = 400;
  return err;
}

export async function assertMemberEmailAvailable(email: string): Promise<void> {
  const client = new CognitoIdentityProviderClient({});
  const poolId = getUserPoolId();
  try {
    await client.send(
      new AdminGetUserCommand({
        UserPoolId: poolId,
        Username: email,
      })
    );
    throw memberEmailTakenError();
  } catch (error) {
    if (error instanceof UserNotFoundException) return;
    throw error;
  }
}

export async function inviteMemberUser(params: {
  email: string;
  name: string;
  tenantId: string;
}): Promise<{ cognitoUserId: string; username: string; temporaryPassword: string }> {
  const client = new CognitoIdentityProviderClient({});
  const poolId = getUserPoolId();
  const temporaryPassword = generateTemporaryPassword();

  try {
    const result = await client.send(
      new AdminCreateUserCommand({
        UserPoolId: poolId,
        Username: params.email,
        TemporaryPassword: temporaryPassword,
        MessageAction: "SUPPRESS",
        UserAttributes: [
          { Name: "email", Value: params.email },
          { Name: "email_verified", Value: "true" },
          { Name: "name", Value: params.name },
          { Name: "custom:tenantId", Value: params.tenantId },
          { Name: "custom:role", Value: "member" },
        ],
      })
    );

    const username = result.User?.Username ?? params.email;
    let sub = attrValue(result.User?.Attributes, "sub");

    if (!sub) {
      const user = await client.send(
        new AdminGetUserCommand({
          UserPoolId: poolId,
          Username: username,
        })
      );
      sub = attrValue(user.UserAttributes, "sub");
    }

    if (!sub) {
      throw new Error("Failed to create member Cognito user");
    }

    return {
      cognitoUserId: sub,
      username,
      temporaryPassword,
    };
  } catch (error) {
    if (error instanceof UsernameExistsException) {
      throw memberEmailTakenError();
    }
    throw error;
  }
}

export async function resendSubaccountOwnerCredentials(params: {
  email: string;
  name: string;
  tenantId: string;
}): Promise<{ username: string; temporaryPassword: string; created: boolean }> {
  const client = new CognitoIdentityProviderClient({});
  const poolId = getUserPoolId();
  const temporaryPassword = generateTemporaryPassword();

  try {
    const existing = await client.send(
      new AdminGetUserCommand({
        UserPoolId: poolId,
        Username: params.email,
      })
    );
    const tenantId = attrValue(existing.UserAttributes, "custom:tenantId");
    if (tenantId !== params.tenantId) {
      throw memberEmailTakenError();
    }
    const username = existing.Username ?? params.email;
    await client.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: poolId,
        Username: username,
        Password: temporaryPassword,
        Permanent: false,
      })
    );
    await client.send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: poolId,
        Username: username,
        UserAttributes: [{ Name: "name", Value: params.name }],
      })
    );
    return { username, temporaryPassword, created: false };
  } catch (error) {
    if (error instanceof UserNotFoundException) {
      const invited = await inviteMemberUser(params);
      return {
        username: invited.username,
        temporaryPassword: invited.temporaryPassword,
        created: true,
      };
    }
    throw error;
  }
}
