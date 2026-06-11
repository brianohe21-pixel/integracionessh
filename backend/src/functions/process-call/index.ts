import type { SQSEvent } from "aws-lambda";
import {
  getCallRecord,
  upsertCallRecord,
  updateCallRecordStatus,
} from "../../lib/dynamodb/call.repository.js";
import { emitIntegrationEvent } from "../../lib/integrations/emit.js";
import {
  buildCallConnectPayload,
  buildCallStatusPayload,
  buildCallTerminatedPayload,
} from "../../lib/integrations/payloads.js";
import type { CallQueueMessage, CallRecordStatus } from "../../types/index.js";

function mapStatusToRecord(status: string | undefined): CallRecordStatus {
  switch (status) {
    case "RINGING":
      return "ringing";
    case "ACCEPTED":
      return "accepted";
    case "REJECTED":
      return "rejected";
    case "COMPLETED":
      return "completed";
    case "FAILED":
      return "failed";
    default:
      return "initiated";
  }
}

function customerPhoneFromMessage(msg: CallQueueMessage): string {
  if (msg.phoneNumber) return msg.phoneNumber;
  if (msg.direction === "BUSINESS_INITIATED") return msg.to ?? "";
  return msg.from ?? msg.to ?? "";
}

async function handleConnect(msg: CallQueueMessage): Promise<void> {
  const now = new Date().toISOString();
  const phoneNumber = customerPhoneFromMessage(msg);
  const existing = await getCallRecord(msg.tenantId, msg.callId);

  if (!existing) {
    await upsertCallRecord({
      callId: msg.callId,
      tenantId: msg.tenantId,
      botId: msg.botId,
      phoneNumber,
      direction: msg.direction ?? "USER_INITIATED",
      status: "initiated",
      startedAt: now,
      createdAt: now,
      updatedAt: now,
      ...(msg.from ? { businessPhoneNumber: msg.from } : {}),
      ...(msg.bizOpaqueCallbackData ? { bizOpaqueCallbackData: msg.bizOpaqueCallbackData } : {}),
    });
  }

  await emitIntegrationEvent(
    msg.tenantId,
    "call.connect",
    buildCallConnectPayload({
      tenantId: msg.tenantId,
      botId: msg.botId,
      callId: msg.callId,
      direction: msg.direction ?? "USER_INITIATED",
      from: msg.from ?? "",
      to: msg.to ?? phoneNumber,
      ...(msg.session ? { session: msg.session } : {}),
      ...(msg.bizOpaqueCallbackData ? { bizOpaqueCallbackData: msg.bizOpaqueCallbackData } : {}),
    })
  );
}

async function handleStatus(msg: CallQueueMessage): Promise<void> {
  const recordStatus = mapStatusToRecord(msg.status);
  const existing = await getCallRecord(msg.tenantId, msg.callId);

  if (existing) {
    await updateCallRecordStatus(msg.tenantId, msg.callId, { status: recordStatus });
  } else {
    const now = new Date().toISOString();
    await upsertCallRecord({
      callId: msg.callId,
      tenantId: msg.tenantId,
      botId: msg.botId,
      phoneNumber: customerPhoneFromMessage(msg),
      direction: "BUSINESS_INITIATED",
      status: recordStatus,
      createdAt: now,
      updatedAt: now,
    });
  }

  await emitIntegrationEvent(
    msg.tenantId,
    "call.status",
    buildCallStatusPayload({
      tenantId: msg.tenantId,
      botId: msg.botId,
      callId: msg.callId,
      status: msg.status ?? "RINGING",
      phoneNumber: customerPhoneFromMessage(msg),
    })
  );
}

async function handleTerminate(msg: CallQueueMessage): Promise<void> {
  const recordStatus = mapStatusToRecord(msg.status);
  const endedAt = msg.endTime
    ? new Date(Number(msg.endTime) * 1000).toISOString()
    : new Date().toISOString();
  const startedAt = msg.startTime
    ? new Date(Number(msg.startTime) * 1000).toISOString()
    : undefined;

  const existing = await getCallRecord(msg.tenantId, msg.callId);
  if (existing) {
    await updateCallRecordStatus(msg.tenantId, msg.callId, {
      status: recordStatus === "initiated" ? "terminated" : recordStatus,
      endedAt,
      ...(msg.duration !== undefined ? { duration: msg.duration } : {}),
      ...(startedAt ? { startedAt } : {}),
    });
  } else {
    const now = new Date().toISOString();
    await upsertCallRecord({
      callId: msg.callId,
      tenantId: msg.tenantId,
      botId: msg.botId,
      phoneNumber: customerPhoneFromMessage(msg),
      direction: msg.direction ?? "USER_INITIATED",
      status: recordStatus === "initiated" ? "terminated" : recordStatus,
      startedAt: startedAt ?? now,
      endedAt,
      createdAt: now,
      updatedAt: now,
      ...(msg.from ? { businessPhoneNumber: msg.from } : {}),
      ...(msg.duration !== undefined ? { duration: msg.duration } : {}),
      ...(msg.bizOpaqueCallbackData ? { bizOpaqueCallbackData: msg.bizOpaqueCallbackData } : {}),
    });
  }

  await emitIntegrationEvent(
    msg.tenantId,
    "call.terminated",
    buildCallTerminatedPayload({
      tenantId: msg.tenantId,
      botId: msg.botId,
      callId: msg.callId,
      direction: msg.direction ?? "USER_INITIATED",
      phoneNumber: customerPhoneFromMessage(msg),
      status: msg.status ?? "COMPLETED",
      ...(msg.duration !== undefined ? { duration: msg.duration } : {}),
      ...(msg.bizOpaqueCallbackData ? { bizOpaqueCallbackData: msg.bizOpaqueCallbackData } : {}),
    })
  );
}

export async function handler(event: SQSEvent): Promise<void> {
  for (const record of event.Records) {
    try {
      const msg = JSON.parse(record.body) as CallQueueMessage;

      if (msg.eventType === "connect") {
        await handleConnect(msg);
      } else if (msg.eventType === "status") {
        await handleStatus(msg);
      } else if (msg.eventType === "terminate") {
        await handleTerminate(msg);
      }
    } catch (err) {
      console.error("Failed to process call event:", err);
      throw err;
    }
  }
}
