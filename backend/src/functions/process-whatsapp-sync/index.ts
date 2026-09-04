import type { SQSBatchResponse, SQSEvent } from "aws-lambda";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getBotByPhoneNumberId } from "../../lib/dynamodb/bot.repository.js";
import { updateBot } from "../../lib/dynamodb/bot.repository.js";
import { handleAccountUpdate } from "../../lib/whatsapp/coexistence/account-update.js";
import {
  handleAccountAlert,
  handlePhoneNumberQualityUpdate,
} from "../../lib/whatsapp/enforcement.js";
import {
  persistCoexistenceContacts,
  persistCoexistenceEchoes,
  persistHistoryPayload,
} from "../../lib/whatsapp/coexistence/persist.js";
import { startCoexistenceSync } from "../../lib/whatsapp/coexistence/start-sync.js";
import type {
  WhatsAppAccountUpdateValue,
  WhatsAppHistoryChunk,
  WhatsAppMessageEcho,
  WhatsAppStateSyncItem,
  WhatsAppSyncPhaseStatus,
  WhatsAppSyncQueueMessage,
} from "../../types/index.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";
const MEDIA_BUCKET = process.env.MEDIA_BUCKET ?? "";
const s3 = new S3Client({});

async function readS3Json<T>(key: string): Promise<T> {
  if (!MEDIA_BUCKET) throw new Error("MEDIA_BUCKET is not configured");
  const result = await s3.send(
    new GetObjectCommand({
      Bucket: MEDIA_BUCKET,
      Key: key,
    })
  );
  const body = await result.Body?.transformToString();
  if (!body) throw new Error(`Empty S3 object: ${key}`);
  return JSON.parse(body) as T;
}

async function processMessage(message: WhatsAppSyncQueueMessage): Promise<void> {
  if (message.jobType === "start_sync" && message.tenantId && message.botId && message.phoneNumberId) {
    await startCoexistenceSync({
      tenantId: message.tenantId,
      botId: message.botId,
      phoneNumberId: message.phoneNumberId,
      environment: ENVIRONMENT,
    });
    return;
  }

  if (message.jobType === "account_update" && message.payload) {
    const wabaId = message.payload.wabaId as string;
    const value = message.payload.value as WhatsAppAccountUpdateValue;
    await handleAccountUpdate({ wabaId, value });
    return;
  }

  if (message.jobType === "phone_quality_update" && message.phoneNumberId && message.payload) {
    await handlePhoneNumberQualityUpdate({
      phoneNumberId: message.phoneNumberId,
      value: message.payload.value as Record<string, unknown>,
    });
    return;
  }

  if (message.jobType === "account_alert" && message.payload) {
    await handleAccountAlert({
      wabaId: message.payload.wabaId as string,
      value: message.payload.value as Record<string, unknown>,
    });
    return;
  }

  const phoneNumberId = message.phoneNumberId;
  if (!phoneNumberId) return;

  const bot = await getBotByPhoneNumberId(phoneNumberId);
  if (!bot) {
    console.log(`No bot for coexistence phoneNumberId=${phoneNumberId}`);
    return;
  }

  if (message.jobType === "history_chunk") {
    let history: WhatsAppHistoryChunk[] = [];
    if (message.s3Key) {
      const payload = await readS3Json<{
        history?: WhatsAppHistoryChunk[];
        metadata?: { display_phone_number?: string };
      }>(message.s3Key);
      history = payload.history ?? [];
      const businessPhone =
        payload.metadata?.display_phone_number ??
        (message.payload?.businessPhone as string | undefined) ??
        "";
      await persistHistoryPayload({
        bot,
        businessPhone,
        phoneNumberId,
        history,
      });
    } else if (message.payload?.history) {
      await persistHistoryPayload({
        bot,
        businessPhone: (message.payload.businessPhone as string) ?? "",
        phoneNumberId,
        history: message.payload.history as WhatsAppHistoryChunk[],
      });
    }

    const progress = message.payload?.progress as number | undefined;
    const phase = message.payload?.phase as number | undefined;
    if (progress !== undefined || phase !== undefined) {
      const historyStatus: WhatsAppSyncPhaseStatus =
        progress === 100 ? "completed" : "in_progress";
      const syncStatus = {
        ...(bot.whatsappSyncStatus ?? {}),
        history: historyStatus,
        ...(progress !== undefined ? { historyProgress: progress } : {}),
        ...(phase !== undefined ? { historyPhase: phase } : {}),
        ...(progress === 100 ? { completedAt: new Date().toISOString() } : {}),
      };
      await updateBot(bot.tenantId, bot.botId, { whatsappSyncStatus: syncStatus });
    }
    return;
  }

  if (message.jobType === "echo_batch" && message.payload?.echoes) {
    await persistCoexistenceEchoes({
      bot,
      echoes: message.payload.echoes as WhatsAppMessageEcho[],
    });
    return;
  }

  if (message.jobType === "contact_batch" && message.payload?.stateSync) {
    await persistCoexistenceContacts({
      bot,
      items: message.payload.stateSync as WhatsAppStateSyncItem[],
    });
    const syncStatus = {
      ...(bot.whatsappSyncStatus ?? {}),
      contacts: "completed" as WhatsAppSyncPhaseStatus,
    };
    await updateBot(bot.tenantId, bot.botId, { whatsappSyncStatus: syncStatus });
  }
}

export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const batchItemFailures: Array<{ itemIdentifier: string }> = [];

  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.body) as WhatsAppSyncQueueMessage;
      await processMessage(message);
    } catch (error) {
      console.error("WhatsApp sync record failed", error);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
}
