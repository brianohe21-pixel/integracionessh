import type {
  PostAuthenticationTriggerEvent,
  PostConfirmationTriggerEvent,
  PreSignUpTriggerEvent,
} from "aws-lambda";
import {
  AdminLinkProviderForUserCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { normalizeEmail } from "../../lib/auth/normalize-email.js";
import { getTenantIdBySsoProvider } from "../../lib/dynamodb/microsoft-sso.repository.js";
import { recordUserLogin } from "../../lib/members/record-login.js";

type CognitoTriggerEvent =
  | PreSignUpTriggerEvent
  | PostConfirmationTriggerEvent
  | PostAuthenticationTriggerEvent;

const DUPLICATE_EMAIL_MESSAGE = "An account with this email already exists";

const client = new CognitoIdentityProviderClient({});

function parseExternalProviderUsername(userName: string): {
  providerName: string;
  providerSubject: string;
} | null {
  const separatorIndex = userName.indexOf("_");
  if (separatorIndex <= 0) return null;
  return {
    providerName: userName.slice(0, separatorIndex),
    providerSubject: userName.slice(separatorIndex + 1),
  };
}

function isMicrosoftSsoProvider(providerName: string): boolean {
  return providerName.startsWith("entra-");
}

async function findExistingUserByEmail(email: string, userPoolId: string) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const listed = await client.send(
    new ListUsersCommand({
      UserPoolId: userPoolId,
      Filter: `email = "${normalizedEmail.replace(/"/g, '\\"')}"`,
      Limit: 1,
    })
  );
  return listed.Users?.[0] ?? null;
}

function readUserAttribute(
  attributes: Array<{ Name?: string | undefined; Value?: string | undefined }> | undefined,
  name: string
): string {
  return attributes?.find((attr) => attr.Name === name)?.Value?.trim() ?? "";
}

async function assertEmailAvailableForSignUp(
  email: string,
  userPoolId: string,
  currentUsername?: string
): Promise<void> {
  const existingUser = await findExistingUserByEmail(email, userPoolId);
  if (!existingUser?.Username) return;
  if (currentUsername && existingUser.Username === currentUsername) return;
  throw new Error(DUPLICATE_EMAIL_MESSAGE);
}

async function linkExternalProviderToExistingUser(
  event: PreSignUpTriggerEvent
): Promise<boolean> {
  const email = event.request.userAttributes.email?.trim();
  if (!email) return false;

  const provider = parseExternalProviderUsername(event.userName);
  if (!provider) return false;

  const existingUser = await findExistingUserByEmail(email, event.userPoolId);
  if (!existingUser?.Username) return false;

  if (isMicrosoftSsoProvider(provider.providerName)) {
    const expectedTenantId = await getTenantIdBySsoProvider(provider.providerName);
    if (!expectedTenantId) {
      throw new Error("Microsoft SSO provider is not configured");
    }
    const existingTenantId = readUserAttribute(existingUser.Attributes, "custom:tenantId");
    if (!existingTenantId || existingTenantId !== expectedTenantId) {
      throw new Error("This account is not invited to this portal");
    }
  }

  await client.send(
    new AdminLinkProviderForUserCommand({
      UserPoolId: event.userPoolId,
      DestinationUser: {
        ProviderName: "Cognito",
        ProviderAttributeValue: existingUser.Username,
      },
      SourceUser: {
        ProviderName: provider.providerName,
        ProviderAttributeName: "Cognito_Subject",
        ProviderAttributeValue: provider.providerSubject,
      },
    })
  );

  return true;
}

async function ensureCustomAttributes(
  event: PostConfirmationTriggerEvent
): Promise<void> {
  const tenantId = event.request.userAttributes["custom:tenantId"]?.trim();
  const role = event.request.userAttributes["custom:role"]?.trim();
  if (tenantId && role) return;

  const attributes: { Name: string; Value: string }[] = [];
  if (!tenantId) {
    const { randomUUID } = await import("node:crypto");
    attributes.push({ Name: "custom:tenantId", Value: randomUUID() });
  }
  if (!role) {
    attributes.push({ Name: "custom:role", Value: "member" });
  }

  await client.send(
    new AdminUpdateUserAttributesCommand({
      UserPoolId: event.userPoolId,
      Username: event.userName,
      UserAttributes: attributes,
    })
  );
}

export async function handler(event: CognitoTriggerEvent): Promise<CognitoTriggerEvent> {
  if (event.triggerSource === "PreSignUp_SignUp") {
    const email = event.request.userAttributes.email?.trim();
    if (!email) {
      throw new Error("Email is required");
    }

    const normalizedEmail = normalizeEmail(email);
    event.request.userAttributes.email = normalizedEmail;
    await assertEmailAvailableForSignUp(normalizedEmail, event.userPoolId, event.userName);
    return event;
  }

  if (event.triggerSource === "PreSignUp_ExternalProvider") {
    const provider = parseExternalProviderUsername(event.userName);
    const microsoftProvider = provider ? isMicrosoftSsoProvider(provider.providerName) : false;
    const email = event.request.userAttributes.email?.trim();

    if (email) {
      event.request.userAttributes.email = normalizeEmail(email);
    }

    if (microsoftProvider) {
      if (!email) {
        throw new Error("Email is required for Microsoft SSO");
      }

      const existingUser = await findExistingUserByEmail(email, event.userPoolId);
      if (!existingUser?.Username) {
        throw new Error("Only invited users can sign in with Microsoft");
      }

      const expectedTenantId = provider
        ? await getTenantIdBySsoProvider(provider.providerName)
        : null;
      if (!expectedTenantId) {
        throw new Error("Microsoft SSO provider is not configured");
      }

      const existingTenantId = readUserAttribute(existingUser.Attributes, "custom:tenantId");
      if (!existingTenantId || existingTenantId !== expectedTenantId) {
        throw new Error("This account is not invited to this portal");
      }
    }

    event.response.autoConfirmUser = true;
    event.response.autoVerifyEmail = true;

    const linked = await linkExternalProviderToExistingUser(event);
    if (!linked && microsoftProvider) {
      throw new Error("Unable to link Microsoft account");
    }

    if (!linked) {
      if (email) {
        await assertEmailAvailableForSignUp(email, event.userPoolId);
      }

      const { randomUUID } = await import("node:crypto");
      if (!event.request.userAttributes["custom:tenantId"]?.trim()) {
        event.request.userAttributes["custom:tenantId"] = randomUUID();
      }
      if (!event.request.userAttributes["custom:role"]?.trim()) {
        event.request.userAttributes["custom:role"] = "member";
      }
    }

    return event;
  }

  if (
    event.triggerSource === "PostConfirmation_ConfirmSignUp" ||
    event.triggerSource === "PostConfirmation_ConfirmForgotPassword"
  ) {
    try {
      await ensureCustomAttributes(event);
    } catch {
      /* attributes will be retried on next confirmation if needed */
    }
  }

  if (event.triggerSource === "PostAuthentication_Authentication") {
    const tenantId = event.request.userAttributes["custom:tenantId"]?.trim() ?? "";
    const userId = event.request.userAttributes.sub?.trim() ?? "";
    const email = event.request.userAttributes.email?.trim();
    const name = event.request.userAttributes.name?.trim();
    const role = event.request.userAttributes["custom:role"]?.trim();

    try {
      await recordUserLogin({
        tenantId,
        userId,
        ...(email ? { email } : {}),
        ...(name ? { name } : {}),
        ...(role ? { role } : {}),
      });
    } catch (error) {
      console.error("Failed to record user login:", error);
    }
  }

  return event;
}
