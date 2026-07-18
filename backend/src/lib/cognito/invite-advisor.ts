import {
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminGetUserCommand,
  CognitoIdentityProviderClient,
  UsernameExistsException,
  type AttributeType,
} from "@aws-sdk/client-cognito-identity-provider";
import { randomBytes } from "crypto";
import { getAdvisorByCognitoUserId } from "../dynamodb/advisor.repository.js";

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

function badRequest(message: string): never {
  const error = new Error(message);
  (error as Error & { statusCode: number }).statusCode = 400;
  throw error;
}

function generateTemporaryPassword(): string {
  const base = randomBytes(12).toString("base64url");
  return `Aa1!${base}`;
}

async function getCognitoUserByEmail(client: CognitoIdentityProviderClient, email: string) {
  const poolId = getUserPoolId();
  const user = await client.send(
    new AdminGetUserCommand({
      UserPoolId: poolId,
      Username: email,
    })
  );

  return {
    username: user.Username ?? email,
    sub: attrValue(user.UserAttributes, "sub"),
    tenantId: attrValue(user.UserAttributes, "custom:tenantId"),
    role: attrValue(user.UserAttributes, "custom:role") || "member",
  };
}

async function assertCanReuseAdvisorEmail(
  client: CognitoIdentityProviderClient,
  email: string,
  tenantId: string
): Promise<string> {
  const existing = await getCognitoUserByEmail(client, email);

  if (!existing.sub) {
    throw new Error("Failed to load existing Cognito user");
  }

  if (existing.role !== "advisor" || existing.tenantId !== tenantId) {
    badRequest("A user with this email already exists");
  }

  const linkedAdvisor = await getAdvisorByCognitoUserId(tenantId, existing.sub);
  if (linkedAdvisor) {
    badRequest("This email is already linked to an active advisor");
  }

  return existing.username;
}

async function createCognitoAdvisorUser(
  client: CognitoIdentityProviderClient,
  params: {
    email: string;
    name: string;
    tenantId: string;
    temporaryPassword: string;
  }
): Promise<{ cognitoUserId: string; username: string; temporaryPassword: string }> {
  const poolId = getUserPoolId();

  const result = await client.send(
    new AdminCreateUserCommand({
      UserPoolId: poolId,
      Username: params.email,
      TemporaryPassword: params.temporaryPassword,
      MessageAction: "SUPPRESS",
      UserAttributes: [
        { Name: "email", Value: params.email },
        { Name: "email_verified", Value: "true" },
        { Name: "name", Value: params.name },
        { Name: "custom:tenantId", Value: params.tenantId },
        { Name: "custom:role", Value: "advisor" },
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
    throw new Error("Failed to create advisor Cognito user");
  }

  return {
    cognitoUserId: sub,
    username,
    temporaryPassword: params.temporaryPassword,
  };
}

export async function inviteAdvisorUser(params: {
  email: string;
  name: string;
  tenantId: string;
}): Promise<{ cognitoUserId: string; username: string; temporaryPassword: string }> {
  const client = new CognitoIdentityProviderClient({});
  const poolId = getUserPoolId();
  const temporaryPassword = generateTemporaryPassword();
  const payload = { ...params, temporaryPassword };

  try {
    return await createCognitoAdvisorUser(client, payload);
  } catch (error) {
    if (!(error instanceof UsernameExistsException)) {
      throw error;
    }

    const username = await assertCanReuseAdvisorEmail(client, params.email, params.tenantId);
    await client.send(
      new AdminDeleteUserCommand({
        UserPoolId: poolId,
        Username: username,
      })
    );

    try {
      return await createCognitoAdvisorUser(client, payload);
    } catch (retryError) {
      if (retryError instanceof UsernameExistsException) {
        badRequest("A user with this email already exists");
      }
      throw retryError;
    }
  }
}
