import {
  AdminCreateUserCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import { randomBytes } from "crypto";

function getUserPoolId(): string {
  const poolId = process.env.COGNITO_USER_POOL_ID?.trim();
  if (!poolId) {
    throw new Error("COGNITO_USER_POOL_ID is not configured");
  }
  return poolId;
}

function generateTemporaryPassword(): string {
  const base = randomBytes(12).toString("base64url");
  return `Aa1!${base}`;
}

export async function inviteAdvisorUser(params: {
  email: string;
  name: string;
  tenantId: string;
}): Promise<{ cognitoUserId: string; username: string; temporaryPassword: string }> {
  const client = new CognitoIdentityProviderClient({});
  const poolId = getUserPoolId();
  const temporaryPassword = generateTemporaryPassword();

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
        { Name: "custom:role", Value: "advisor" },
      ],
    })
  );

  const attrs = result.User?.Attributes ?? [];
  const sub = attrs.find((a) => a.Name === "sub")?.Value?.trim() ?? "";
  const username = result.User?.Username ?? params.email;

  if (!sub) {
    throw new Error("Failed to create advisor Cognito user");
  }

  return { cognitoUserId: sub, username, temporaryPassword };
}
