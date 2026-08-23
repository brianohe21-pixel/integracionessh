import {
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  UsernameExistsException,
  type AttributeType,
} from "@aws-sdk/client-cognito-identity-provider";
import { DEMO_TENANT_ID } from "./constants.js";

function getUserPoolId(): string {
  const poolId = (
    process.env.COGNITO_USER_POOL_ID ??
    process.env.NEXT_PUBLIC_USER_POOL_ID ??
    ""
  ).trim();
  if (!poolId) {
    throw new Error(
      "COGNITO_USER_POOL_ID is not configured. Set it to your dev Cognito User Pool id (e.g. us-east-1_CWNhdPTjN)."
    );
  }
  return poolId;
}

function readAttr(attrs: AttributeType[] | undefined, name: string): string {
  return attrs?.find((item) => item.Name === name)?.Value?.trim() ?? "";
}

export async function upsertDemoCognitoUser(params: {
  email: string;
  password: string;
  name: string;
}): Promise<{ userId: string; username: string }> {
  const client = new CognitoIdentityProviderClient({});
  const poolId = getUserPoolId();
  const attributes = [
    { Name: "email", Value: params.email },
    { Name: "email_verified", Value: "true" },
    { Name: "name", Value: params.name },
    { Name: "custom:tenantId", Value: DEMO_TENANT_ID },
    { Name: "custom:role", Value: "member" },
  ];

  let username = params.email;

  try {
    const created = await client.send(
      new AdminCreateUserCommand({
        UserPoolId: poolId,
        Username: params.email,
        MessageAction: "SUPPRESS",
        UserAttributes: attributes,
      })
    );
    username = created.User?.Username ?? params.email;
  } catch (error) {
    if (!(error instanceof UsernameExistsException)) {
      throw error;
    }

    await client.send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: poolId,
        Username: params.email,
        UserAttributes: attributes,
      })
    );
  }

  await client.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: poolId,
      Username: username,
      Password: params.password,
      Permanent: true,
    })
  );

  const user = await client.send(
    new AdminGetUserCommand({
      UserPoolId: poolId,
      Username: username,
    })
  );

  const userId = readAttr(user.UserAttributes, "sub");
  if (!userId) {
    throw new Error("Failed to resolve demo Cognito user id");
  }

  return { userId, username };
}
