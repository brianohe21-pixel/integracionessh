import { listBots } from "../dynamodb/bot.repository.js";
import {
  getWhatsAppAccount,
  getWhatsAppAccountByWabaId,
  updateWhatsAppAccount,
} from "../dynamodb/whatsapp-account.repository.js";
import {
  getWhatsAppChannel,
  getWhatsAppChannelByPhoneNumberId,
  listWhatsAppChannels,
  updateWhatsAppChannel,
} from "../dynamodb/whatsapp-channel.repository.js";
import { getTenant } from "../dynamodb/tenant.repository.js";
import { writeComplianceLog } from "../compliance/audit-log.js";
import { notifyWhatsAppEnforcementBlock } from "../email/whatsapp-enforcement-notify.js";
import { emitOpsAlertSafe } from "../ops-alerts/emit.js";
import { assessWhatsAppPhone } from "./assess-quality.js";
import { getPhoneNumberInfo, getWhatsAppAccessToken } from "./client.js";
import type {
  WhatsAppAccountUpdateValue,
  WhatsAppChannel,
  WhatsAppEnforcementSource,
  WhatsAppMessagingEnforcement,
  WhatsAppQualitySnapshot,
} from "../../types/index.js";

const BLOCKING_ACCOUNT_EVENTS = new Set([
  "ACCOUNT_VIOLATION",
  "ACCOUNT_RESTRICTION",
  "DISABLED_UPDATE",
  "ACCOUNT_DELETED",
]);

export interface ChannelRef {
  tenantId: string;
  botId: string;
  channel: WhatsAppChannel;
}

export async function listChannelsForWaba(wabaId: string): Promise<ChannelRef[]> {
  const account = await getWhatsAppAccountByWabaId(wabaId);
  if (!account) return [];

  const bots = await listBots(account.tenantId);
  const refs: ChannelRef[] = [];

  for (const bot of bots) {
    const channels = await listWhatsAppChannels(account.tenantId, bot.botId);
    for (const channel of channels) {
      if (
        channel.accountId === account.accountId ||
        channel.whatsappBusinessAccountId === wabaId
      ) {
        refs.push({ tenantId: account.tenantId, botId: bot.botId, channel });
      }
    }
  }

  return refs;
}

function buildEnforcementBlock(params: {
  reason: string;
  event?: string;
  source?: WhatsAppEnforcementSource;
  blockedBy?: string;
}): WhatsAppMessagingEnforcement {
  return {
    blocked: true,
    reason: params.reason,
    ...(params.event ? { event: params.event } : {}),
    source: params.source ?? "meta_auto",
    blockedAt: new Date().toISOString(),
    ...(params.blockedBy ? { blockedBy: params.blockedBy } : {}),
  };
}

export async function blockWhatsAppChannel(params: {
  tenantId: string;
  botId: string;
  channelId: string;
  reason: string;
  event?: string;
  source?: WhatsAppMessagingEnforcement["source"];
  blockedBy?: string;
  qualitySnapshot?: WhatsAppQualitySnapshot;
}): Promise<WhatsAppChannel | null> {
  const existing = await getWhatsAppChannel(params.tenantId, params.botId, params.channelId);
  if (!existing) return null;
  if (existing.messagingEnforcement?.blocked && existing.messagingEnforcement.source === "meta_auto") {
    return existing;
  }

  const enforcement = buildEnforcementBlock({
    reason: params.reason,
    ...(params.event ? { event: params.event } : {}),
    ...(params.source ? { source: params.source } : {}),
    ...(params.blockedBy ? { blockedBy: params.blockedBy } : {}),
  });
  const updated = await updateWhatsAppChannel(params.tenantId, params.botId, params.channelId, {
    messagingEnforcement: enforcement,
    ...(params.qualitySnapshot ? { qualitySnapshot: params.qualitySnapshot } : {}),
  });

  if (updated) {
    await writeComplianceLog({
      tenantId: params.tenantId,
      action: "whatsapp_enforcement_blocked",
      phone: updated.displayPhoneNumber ?? updated.phoneNumberId,
      reason: params.reason,
      ...(params.blockedBy ? { actorUserId: params.blockedBy } : {}),
    }).catch((err) => console.warn("Compliance log failed:", err));

    const tenant = await getTenant(params.tenantId);
    if (tenant) {
      await notifyWhatsAppEnforcementBlock({
        tenant,
        channel: updated,
        reason: params.reason,
        ...(params.event ? { event: params.event } : {}),
      }).catch((err) => console.warn("Enforcement notify failed:", err));
    }

    const isQuality =
      params.qualitySnapshot?.qualityRating === "RED" ||
      params.reason.toLowerCase().includes("quality") ||
      params.reason === "red";
    const phoneLabel =
      updated.displayPhoneNumber ?? updated.phoneNumberId ?? params.channelId;

    if (isQuality) {
      emitOpsAlertSafe({
        tenantId: params.tenantId,
        ruleId: "whatsapp_quality",
        title: "WhatsApp quality blocked",
        body: `Outbound messaging blocked for ${phoneLabel}: ${params.reason}`,
        href: `/bots/${params.botId}`,
        severity: "critical",
        dedupeKey: `whatsapp_quality:${params.channelId}`,
      });
    } else {
      emitOpsAlertSafe({
        tenantId: params.tenantId,
        ruleId: "channel_down",
        title: "WhatsApp channel blocked",
        body: `Channel ${phoneLabel} blocked: ${params.reason}`,
        href: `/bots/${params.botId}`,
        severity: "critical",
        dedupeKey: `channel_down:${params.channelId}:blocked`,
      });
    }
  }

  return updated;
}

export async function blockWhatsAppAccount(params: {
  wabaId: string;
  reason: string;
  event?: string;
  source?: WhatsAppMessagingEnforcement["source"];
  blockedBy?: string;
}): Promise<void> {
  const account = await getWhatsAppAccountByWabaId(params.wabaId);
  if (!account) return;

  const enforcement = buildEnforcementBlock({
    reason: params.reason,
    ...(params.event ? { event: params.event } : {}),
    ...(params.source ? { source: params.source } : {}),
    ...(params.blockedBy ? { blockedBy: params.blockedBy } : {}),
  });
  await updateWhatsAppAccount(account.tenantId, account.accountId, {
    messagingEnforcement: enforcement,
  });

  const channelRefs = await listChannelsForWaba(params.wabaId);
  await Promise.all(
    channelRefs.map(({ tenantId, botId, channel }) =>
      blockWhatsAppChannel({
        tenantId,
        botId,
        channelId: channel.channelId,
        reason: params.reason,
        ...(params.event ? { event: params.event } : {}),
        source: params.source ?? "meta_auto",
        ...(params.blockedBy ? { blockedBy: params.blockedBy } : {}),
      })
    )
  );
}

export async function handlePhoneNumberQualityUpdate(params: {
  phoneNumberId: string;
  value: Record<string, unknown>;
}): Promise<void> {
  const channel = await getWhatsAppChannelByPhoneNumberId(params.phoneNumberId);
  if (!channel) return;

  const qualityRating = String(
    params.value.quality_rating ?? params.value.qualityRating ?? "NA"
  ).toUpperCase() as WhatsAppQualitySnapshot["qualityRating"];
  const phoneStatus = String(params.value.event ?? params.value.status ?? "UNKNOWN");
  const assessment = assessWhatsAppPhone({
    qualityRating,
    status: phoneStatus,
    ...(channel.displayPhoneNumber ? { displayPhoneNumber: channel.displayPhoneNumber } : {}),
  });

  const snapshot: WhatsAppQualitySnapshot = {
    qualityRating,
    phoneStatus,
    risk: assessment.risk,
    source: "webhook",
    updatedAt: new Date().toISOString(),
    rawEvent: JSON.stringify(params.value).slice(0, 2000),
  };

  await updateWhatsAppChannel(channel.tenantId, channel.botId, channel.channelId, {
    qualitySnapshot: snapshot,
  });

  if (qualityRating === "RED" && assessment.risk !== "block") {
    emitOpsAlertSafe({
      tenantId: channel.tenantId,
      ruleId: "whatsapp_quality",
      title: "WhatsApp quality is RED",
      body: `Phone ${channel.displayPhoneNumber ?? channel.phoneNumberId} quality rating is RED.`,
      href: `/bots/${channel.botId}`,
      severity: "critical",
      dedupeKey: `whatsapp_quality:${channel.channelId}:red`,
    });
  }

  if (assessment.risk !== "block") return;

  await blockWhatsAppChannel({
    tenantId: channel.tenantId,
    botId: channel.botId,
    channelId: channel.channelId,
    reason: assessment.blockReason ?? "quality_block",
    event: phoneStatus,
    qualitySnapshot: snapshot,
  });
}

export async function handleAccountAlert(params: {
  wabaId: string;
  value: Record<string, unknown>;
}): Promise<void> {
  const alertType = String(params.value.alert_type ?? params.value.alertType ?? "").toUpperCase();
  const entityType = String(params.value.entity_type ?? params.value.entityType ?? "").toUpperCase();
  const entityId = String(params.value.entity_id ?? params.value.entityId ?? "");

  const blockingAlerts = new Set([
    "ACCOUNT_VIOLATION",
    "ACCOUNT_RESTRICTION",
    "PHONE_NUMBER_QUALITY_UPDATE",
    "PHONE_NUMBER_FLAGGED",
    "WABA_VIOLATION",
    "WABA_RESTRICTION",
  ]);

  if (!blockingAlerts.has(alertType)) return;

  if (entityType === "PHONE_NUMBER" && entityId) {
    await handlePhoneNumberQualityUpdate({
      phoneNumberId: entityId,
      value: params.value,
    });
    return;
  }

  await blockWhatsAppAccount({
    wabaId: params.wabaId,
    reason: alertType.toLowerCase(),
    event: alertType,
  });
}

export async function handleAccountUpdateEnforcement(params: {
  wabaId: string;
  value: WhatsAppAccountUpdateValue;
}): Promise<void> {
  const event = params.value.event ?? "";

  if (params.value.ban_info?.waba_ban_state && params.value.ban_info.waba_ban_state !== "NONE") {
    await blockWhatsAppAccount({
      wabaId: params.wabaId,
      reason: "waba_banned",
      event: params.value.ban_info.waba_ban_state,
    });
    return;
  }

  if (params.value.violation_info?.violation_type) {
    await blockWhatsAppAccount({
      wabaId: params.wabaId,
      reason: params.value.violation_info.violation_type,
      event: "ACCOUNT_VIOLATION",
    });
    return;
  }

  if (params.value.restriction_info?.length) {
    await blockWhatsAppAccount({
      wabaId: params.wabaId,
      reason: "account_restricted",
      event: "ACCOUNT_RESTRICTION",
    });
    return;
  }

  if (BLOCKING_ACCOUNT_EVENTS.has(event)) {
    await blockWhatsAppAccount({
      wabaId: params.wabaId,
      reason: event.toLowerCase(),
      event,
    });
  }
}

export async function clearMetaEnforcement(params: {
  tenantId: string;
  botId: string;
  channelId: string;
  clearedBy: string;
  environment: string;
}): Promise<WhatsAppChannel | null> {
  const existing = await getWhatsAppChannel(params.tenantId, params.botId, params.channelId);
  if (!existing) return null;

  const enforcement = existing.messagingEnforcement;
  if (!enforcement?.blocked) return existing;
  if (enforcement.source !== "meta_auto") {
    const err = new Error("Only Meta-enforced blocks can be cleared by admin") as Error & {
      statusCode?: number;
    };
    err.statusCode = 403;
    throw err;
  }

  const accessToken = await getWhatsAppAccessToken(params.tenantId, params.environment);
  const phoneInfo = await getPhoneNumberInfo(existing.phoneNumberId, accessToken);
  const assessment = assessWhatsAppPhone(phoneInfo);
  if (assessment.risk === "block") {
    const err = new Error("Meta still reports this number as blocked or restricted") as Error & {
      statusCode?: number;
    };
    err.statusCode = 422;
    throw err;
  }

  const account = await getWhatsAppAccount(params.tenantId, existing.accountId);
  if (account?.messagingEnforcement?.blocked && account.messagingEnforcement.source === "meta_auto") {
    const err = new Error("WABA account is still blocked by Meta") as Error & { statusCode?: number };
    err.statusCode = 422;
    throw err;
  }

  const cleared: WhatsAppMessagingEnforcement = {
    blocked: false,
    source: "platform_admin",
    clearedAt: new Date().toISOString(),
    clearedBy: params.clearedBy,
  };

  const updated = await updateWhatsAppChannel(params.tenantId, params.botId, params.channelId, {
    messagingEnforcement: cleared,
    qualitySnapshot: {
      qualityRating: phoneInfo.qualityRating ?? "NA",
      phoneStatus: phoneInfo.status,
      risk: assessment.risk,
      source: "manual",
      updatedAt: new Date().toISOString(),
    },
  });

  if (updated) {
    await writeComplianceLog({
      tenantId: params.tenantId,
      action: "whatsapp_enforcement_cleared",
      phone: updated.displayPhoneNumber ?? updated.phoneNumberId,
      reason: "admin_clear_after_meta_revalidation",
      actorUserId: params.clearedBy,
    }).catch((err) => console.warn("Compliance log failed:", err));
  }

  return updated;
}

export function isChannelOutboundBlocked(channel: WhatsAppChannel | null | undefined): boolean {
  return Boolean(channel?.messagingEnforcement?.blocked);
}

export function isAccountOutboundBlocked(
  account: { messagingEnforcement?: WhatsAppMessagingEnforcement } | null | undefined
): boolean {
  return Boolean(account?.messagingEnforcement?.blocked);
}
