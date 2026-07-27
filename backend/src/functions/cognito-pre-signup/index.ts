import { randomUUID } from "node:crypto";
import type {
  PostConfirmationTriggerEvent,
  PreSignUpTriggerEvent,
} from "aws-lambda";
import {
  AdminLinkProviderForUserCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";

type CognitoTriggerEvent = PreSignUpTriggerEvent | PostConfirmationTriggerEvent;

const client = new CognitoIdentityProviderClient({});

function parseGoogleProviderUsername(userName: string): {
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

async function linkExternalProviderToExistingUser(
  event: PreSignUpTriggerEvent
): Promise<boolean> {
  const email = event.request.userAttributes.email?.trim();
  if (!email) return false;

  const provider = parseGoogleProviderUsername(event.userName);
  if (!provider) return false;

  const listed = await client.send(
    new ListUsersCommand({
      UserPoolId: event.userPoolId,
      Filter: `email = "${email.replace(/"/g, '\\"')}"`,
      Limit: 1,
    })
  );

  const existingUser = listed.Users?.[0];
  if (!existingUser?.Username) return false;

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
  if (event.triggerSource === "PreSignUp_ExternalProvider") {
    event.response.autoConfirmUser = true;
    event.response.autoVerifyEmail = true;

    let linked = false;
    try {
      linked = await linkExternalProviderToExistingUser(event);
    } catch {
      /* linking is best-effort */
    }

    if (!linked) {
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

  return event;
}
