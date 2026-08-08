import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { getBot } from "../../dynamodb/bot.repository.js";
import { updateBot } from "../../dynamodb/bot.repository.js";
import {
  getEmailImapSyncState,
  putEmailImapSyncState,
  listActiveEmailImapLookups,
} from "../../dynamodb/email-imap-sync.repository.js";
import { getImapSecret } from "./secrets.js";
import { fetchImapMessagesSinceUid } from "./client.js";
import { parseEmailMime, messageHashFromId } from "../mime.js";
import { conversationLookupGsi1pk } from "../../channels/keys.js";
import type { EmailInboundPayload, InboundQueueMessage } from "../../../types/index.js";

const sqs = new SQSClient({});
const QUEUE_URL = process.env.SQS_QUEUE_URL ?? "";
const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";
const MAX_MESSAGES_PER_BOT = 50;

export async function pollImapMailbox(
  tenantId: string,
  botId: string
): Promise<{ processed: number; error?: string }> {
  const bot = await getBot(tenantId, botId);
  if (!bot?.emailEnabled || bot.status !== "active" || bot.emailInboundProvider !== "imap") {
    return { processed: 0 };
  }
  if (bot.emailImapPollingEnabled === false) {
    return { processed: 0 };
  }
  if (!bot.emailImapHost || !bot.emailImapUsername) {
    return { processed: 0, error: "IMAP configuration incomplete" };
  }

  const secret = await getImapSecret(tenantId, botId, ENVIRONMENT);
  const syncState = await getEmailImapSyncState(tenantId, botId);
  const uidValidity = syncState?.uidValidity ?? 0;
  const lastUid = syncState?.lastUid ?? 0;

  try {
    const result = await fetchImapMessagesSinceUid(
      {
        host: bot.emailImapHost,
        port: bot.emailImapPort ?? 993,
        username: bot.emailImapUsername,
        password: secret.password,
        useTls: bot.emailImapUseTls !== false,
        mailbox: bot.emailImapMailbox || "INBOX",
      },
      uidValidity,
      lastUid,
      MAX_MESSAGES_PER_BOT
    );

    let processed = 0;
    let highestUid = lastUid;

    for (const message of result.messages) {
      const messageHash = messageHashFromId(`imap:${message.uid}@${bot.emailImapMailbox || "INBOX"}`);
      const emailPayload = await parseEmailMime(message.source, {
        tenantId,
        botId,
        messageHash,
        storeRawMime: true,
      });

      if (!emailPayload) {
        highestUid = Math.max(highestUid, message.uid);
        continue;
      }

      const normalizedTo = bot.emailAddress?.toLowerCase() || emailPayload.to;
      emailPayload.to = normalizedTo;

      await enqueueEmailMessage(tenantId, botId, emailPayload);
      highestUid = Math.max(highestUid, message.uid);
      processed += 1;
    }

    await putEmailImapSyncState({
      tenantId,
      botId,
      uidValidity: result.uidValidity,
      lastUid: highestUid,
      lastPolledAt: new Date().toISOString(),
      consecutiveFailures: 0,
    });

    await updateBot(tenantId, botId, {
      emailImapLastSyncAt: new Date().toISOString(),
      emailImapLastError: "",
    });

    return { processed };
  } catch (error) {
    const message = error instanceof Error ? error.message : "IMAP poll failed";
    const failures = (syncState?.consecutiveFailures ?? 0) + 1;
    await putEmailImapSyncState({
      tenantId,
      botId,
      uidValidity,
      lastUid,
      lastPolledAt: new Date().toISOString(),
      consecutiveFailures: failures,
      ...(failures >= 3 ? { nextPollAfter: new Date(Date.now() + 30 * 60 * 1000).toISOString() } : {}),
    });
    await updateBot(tenantId, botId, {
      emailImapLastError: message,
      ...(failures >= 3 ? { emailImapPollingEnabled: false } : {}),
    });
    return { processed: 0, error: message };
  }
}

async function enqueueEmailMessage(
  tenantId: string,
  botId: string,
  emailPayload: EmailInboundPayload
): Promise<void> {
  const participantId = emailPayload.from;
  const conversationKey = conversationLookupGsi1pk(tenantId, botId, "email", participantId);
  const sqsBody: InboundQueueMessage = {
    channel: "email",
    tenantId,
    botId,
    participantId,
    conversationKey,
    replyToExternalId: emailPayload.messageId,
    payload: emailPayload,
  };

  await sqs.send(
    new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify(sqsBody),
      MessageGroupId: conversationKey,
      MessageDeduplicationId: emailPayload.messageId,
    })
  );
}

export async function pollAllActiveImapMailboxes(): Promise<void> {
  const lookups = await listActiveEmailImapLookups();
  for (const lookup of lookups) {
    const syncState = await getEmailImapSyncState(lookup.tenantId, lookup.botId);
    if (syncState?.nextPollAfter && new Date(syncState.nextPollAfter) > new Date()) {
      continue;
    }
    await pollImapMailbox(lookup.tenantId, lookup.botId);
  }
}
