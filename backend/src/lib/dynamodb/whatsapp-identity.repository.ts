import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_NAME } from "./client.js";
import {
  isWhatsAppBsuid,
  normalizeWhatsAppPhoneId,
  type WhatsAppIdentityChange,
} from "../whatsapp/identity.js";
import {
  conversationLookupGsi1pk,
  legacyPhoneGsi1pk,
  whatsappConversationLookupGsi1pk,
} from "../channels/keys.js";
import type { Conversation } from "../../types/index.js";

export type WhatsAppIdentityLink = {
  tenantId: string;
  botId: string;
  identity: string;
  canonicalParticipantId: string;
  phoneNumber?: string;
  whatsappUserId?: string;
  whatsappParentUserId?: string;
  businessPhoneNumberId?: string;
  updatedAt: string;
};

function identityLookupKey(tenantId: string, botId: string, identity: string) {
  return {
    PK: `LOOKUP#WA_IDENTITY#${tenantId}#${botId}#${identity}`,
    SK: "META",
  };
}

function normalizeIdentity(identity: string): string {
  const trimmed = identity.trim();
  if (isWhatsAppBsuid(trimmed)) return trimmed;
  return normalizeWhatsAppPhoneId(trimmed) || trimmed;
}

export async function getWhatsAppIdentityLink(
  tenantId: string,
  botId: string,
  identity: string
): Promise<WhatsAppIdentityLink | null> {
  const normalized = normalizeIdentity(identity);
  if (!normalized) return null;

  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: identityLookupKey(tenantId, botId, normalized),
    })
  );
  if (!result.Item) return null;

  const { PK: _pk, SK: _sk, ...rest } = result.Item;
  return rest as WhatsAppIdentityLink;
}

export async function rememberWhatsAppIdentityLink(params: {
  tenantId: string;
  botId: string;
  canonicalParticipantId: string;
  phoneNumber?: string;
  whatsappUserId?: string;
  whatsappParentUserId?: string;
  businessPhoneNumberId?: string;
  aliasIds?: string[];
}): Promise<void> {
  const phoneNumber = params.phoneNumber
    ? normalizeWhatsAppPhoneId(params.phoneNumber)
    : undefined;
  const whatsappUserId = params.whatsappUserId?.trim();
  const whatsappParentUserId = params.whatsappParentUserId?.trim();
  const identities = [
    params.canonicalParticipantId,
    phoneNumber,
    whatsappUserId,
    whatsappParentUserId,
    ...(params.aliasIds ?? []),
  ].filter((value): value is string => Boolean(value?.trim()));

  const unique = [...new Set(identities.map(normalizeIdentity).filter(Boolean))];
  if (unique.length === 0) return;

  const now = new Date().toISOString();
  await Promise.all(
    unique.map((identity) =>
      docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            ...identityLookupKey(params.tenantId, params.botId, identity),
            tenantId: params.tenantId,
            botId: params.botId,
            identity,
            canonicalParticipantId: params.canonicalParticipantId,
            ...(phoneNumber ? { phoneNumber } : {}),
            ...(whatsappUserId ? { whatsappUserId } : {}),
            ...(whatsappParentUserId ? { whatsappParentUserId } : {}),
            ...(params.businessPhoneNumberId
              ? { businessPhoneNumberId: params.businessPhoneNumberId }
              : {}),
            updatedAt: now,
          },
        })
      )
    )
  );
}

export async function resolveCanonicalWhatsAppParticipant(params: {
  tenantId: string;
  botId: string;
  participantId: string;
  phoneNumber?: string;
  whatsappUserId?: string;
  whatsappParentUserId?: string;
}): Promise<{
  participantId: string;
  phoneNumber?: string;
  whatsappUserId?: string;
  whatsappParentUserId?: string;
  lookupIds: string[];
}> {
  const seedIds = [
    params.participantId,
    params.whatsappUserId,
    params.whatsappParentUserId,
    params.phoneNumber,
  ].filter((value): value is string => Boolean(value?.trim()));

  let phoneNumber = params.phoneNumber
    ? normalizeWhatsAppPhoneId(params.phoneNumber)
    : undefined;
  let whatsappUserId = params.whatsappUserId?.trim();
  let whatsappParentUserId = params.whatsappParentUserId?.trim();

  for (const seed of seedIds) {
    const link = await getWhatsAppIdentityLink(params.tenantId, params.botId, seed);
    if (!link) continue;
    if (link.phoneNumber) phoneNumber = normalizeWhatsAppPhoneId(link.phoneNumber);
    if (link.whatsappUserId) whatsappUserId = link.whatsappUserId;
    if (link.whatsappParentUserId) whatsappParentUserId = link.whatsappParentUserId;
  }

  const participantId =
    whatsappUserId ||
    (isWhatsAppBsuid(params.participantId)
      ? params.participantId.trim()
      : phoneNumber ||
        normalizeWhatsAppPhoneId(params.participantId) ||
        params.participantId.trim());

  const lookupIds = [
    ...new Set(
      [participantId, whatsappUserId, whatsappParentUserId, phoneNumber, ...seedIds]
        .filter((value): value is string => Boolean(value?.trim()))
        .map((value) =>
          isWhatsAppBsuid(value) ? value.trim() : normalizeWhatsAppPhoneId(value) || value.trim()
        )
        .filter(Boolean)
    ),
  ];

  return {
    participantId,
    ...(phoneNumber ? { phoneNumber } : {}),
    ...(whatsappUserId ? { whatsappUserId } : {}),
    ...(whatsappParentUserId ? { whatsappParentUserId } : {}),
    lookupIds,
  };
}

async function findConversationsByLookupIds(params: {
  tenantId: string;
  botId: string;
  lookupIds: string[];
  businessPhoneNumberId?: string;
}): Promise<Conversation[]> {
  const keys = new Set<string>();
  for (const lookupId of params.lookupIds) {
    if (params.businessPhoneNumberId) {
      keys.add(
        whatsappConversationLookupGsi1pk(
          params.tenantId,
          params.botId,
          params.businessPhoneNumberId,
          lookupId
        )
      );
    }
    keys.add(conversationLookupGsi1pk(params.tenantId, params.botId, "whatsapp", lookupId));
    keys.add(legacyPhoneGsi1pk(params.tenantId, params.botId, lookupId));
  }

  const found = new Map<string, Conversation>();
  for (const gsi1pk of keys) {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :gsi1pk",
        ExpressionAttributeValues: { ":gsi1pk": gsi1pk },
        ScanIndexForward: false,
        Limit: 25,
      })
    );
    for (const item of result.Items ?? []) {
      const { PK, SK, GSI1PK, GSI1SK, ...rest } = item;
      void PK;
      void SK;
      void GSI1PK;
      void GSI1SK;
      const conv = rest as Conversation;
      if (!conv.conversationId) continue;
      found.set(conv.conversationId, {
        ...conv,
        channel: conv.channel ?? "whatsapp",
        participantId: conv.participantId ?? conv.phoneNumber,
        phoneNumber: conv.phoneNumber ?? conv.participantId ?? "",
        handoffMode: conv.handoffMode ?? "bot",
      });
    }
  }
  return [...found.values()];
}

export async function applyWhatsAppIdentityChange(params: {
  tenantId: string;
  botId: string;
  change: WhatsAppIdentityChange;
  businessPhoneNumberId?: string;
}): Promise<void> {
  const previousIds = [
    params.change.previousUserId,
    params.change.previousParentUserId,
    params.change.previousWaId,
  ].filter((value): value is string => Boolean(value?.trim()));

  const nextUserId = params.change.userId?.trim();
  const nextParentUserId = params.change.parentUserId?.trim();
  const nextPhone = params.change.waId
    ? normalizeWhatsAppPhoneId(params.change.waId)
    : undefined;

  if (previousIds.length === 0 && !nextUserId && !nextPhone) return;

  const lookupIds = [
    ...previousIds,
    nextUserId,
    nextParentUserId,
    nextPhone,
  ].filter((value): value is string => Boolean(value?.trim()));

  const conversations = await findConversationsByLookupIds({
    tenantId: params.tenantId,
    botId: params.botId,
    lookupIds,
    ...(params.businessPhoneNumberId
      ? { businessPhoneNumberId: params.businessPhoneNumberId }
      : {}),
  });

  const canonicalParticipantId = nextUserId || nextPhone || previousIds[0]!;

  for (const conversation of conversations) {
    const patchParts: string[] = [];
    const names: Record<string, string> = {};
    const values: Record<string, unknown> = {};

    if (nextUserId) {
      names["#whatsappUserId"] = "whatsappUserId";
      values[":whatsappUserId"] = nextUserId;
      patchParts.push("#whatsappUserId = :whatsappUserId");
    }
    if (nextParentUserId) {
      names["#whatsappParentUserId"] = "whatsappParentUserId";
      values[":whatsappParentUserId"] = nextParentUserId;
      patchParts.push("#whatsappParentUserId = :whatsappParentUserId");
    }
    if (nextPhone) {
      names["#phoneNumber"] = "phoneNumber";
      values[":phoneNumber"] = nextPhone;
      patchParts.push("#phoneNumber = :phoneNumber");
    }
    if (nextUserId && conversation.participantId !== nextUserId) {
      names["#participantId"] = "participantId";
      values[":participantId"] = nextUserId;
      patchParts.push("#participantId = :participantId");

      const gsi1pk = params.businessPhoneNumberId
        ? whatsappConversationLookupGsi1pk(
            params.tenantId,
            params.botId,
            params.businessPhoneNumberId,
            nextUserId
          )
        : conversationLookupGsi1pk(params.tenantId, params.botId, "whatsapp", nextUserId);
      names["#GSI1PK"] = "GSI1PK";
      values[":gsi1pk"] = gsi1pk;
      patchParts.push("#GSI1PK = :gsi1pk");
    }

    if (patchParts.length > 0) {
      await docClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: {
            PK: `TENANT#${params.tenantId}#BOT#${params.botId}`,
            SK: `CONV#${conversation.conversationId}`,
          },
          UpdateExpression: `SET ${patchParts.join(", ")}`,
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
        })
      );
    }
  }

  await rememberWhatsAppIdentityLink({
    tenantId: params.tenantId,
    botId: params.botId,
    canonicalParticipantId,
    ...(nextPhone ? { phoneNumber: nextPhone } : {}),
    ...(nextUserId ? { whatsappUserId: nextUserId } : {}),
    ...(nextParentUserId ? { whatsappParentUserId: nextParentUserId } : {}),
    ...(params.businessPhoneNumberId
      ? { businessPhoneNumberId: params.businessPhoneNumberId }
      : {}),
    aliasIds: previousIds,
  });
}
