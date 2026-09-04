import { getContactByPhone } from "../dynamodb/contact.repository.js";
import { getWhatsAppAccount } from "../dynamodb/whatsapp-account.repository.js";
import {
  getWhatsAppChannelByPhoneNumberId,
} from "../dynamodb/whatsapp-channel.repository.js";
import { checkMarketingRecipients } from "../compliance/recipient-policy.js";
import { isAccountOutboundBlocked, isChannelOutboundBlocked } from "./enforcement.js";
import type { WhatsAppChannel, WhatsAppOutboundSendKind } from "../../types/index.js";

export class WhatsAppOutboundBlockedError extends Error {
  statusCode = 403;
  code = "WHATSAPP_OUTBOUND_BLOCKED";

  constructor(
    message: string,
    public readonly details: {
      reason: string;
      phoneNumberId: string;
      kind: WhatsAppOutboundSendKind;
      enforcementSource?: string;
    }
  ) {
    super(message);
  }
}

function throwBlocked(params: {
  phoneNumberId: string;
  kind: WhatsAppOutboundSendKind;
  reason: string;
  enforcementSource?: string;
}): never {
  throw new WhatsAppOutboundBlockedError(
    `WhatsApp outbound blocked: ${params.reason}`,
    {
      reason: params.reason,
      phoneNumberId: params.phoneNumberId,
      kind: params.kind,
      ...(params.enforcementSource ? { enforcementSource: params.enforcementSource } : {}),
    }
  );
}

async function assertMarketingRecipient(
  tenantId: string,
  to: string | undefined,
  requireOptIn: boolean
): Promise<void> {
  if (!requireOptIn || !to) return;

  const normalized = to.replace(/\D/g, "");
  const { allowed } = await checkMarketingRecipients(tenantId, [normalized]);
  if (allowed.length === 0) {
    const contact = await getContactByPhone(tenantId, normalized);
    const reason =
      !contact || contact.marketingConsent !== "opt_in"
        ? "marketing_opt_in_required"
        : contact.suppressed
          ? "recipient_suppressed"
          : "marketing_not_eligible";
    throwBlocked({
      phoneNumberId: "",
      kind: "marketing",
      reason,
    });
  }
}

async function assertEnforcementForChannel(
  channel: WhatsAppChannel,
  phoneNumberId: string,
  kind: WhatsAppOutboundSendKind
): Promise<void> {
  if (isChannelOutboundBlocked(channel)) {
    throwBlocked({
      phoneNumberId,
      kind,
      reason: channel.messagingEnforcement?.reason ?? "channel_blocked",
      ...(channel.messagingEnforcement?.source
        ? { enforcementSource: channel.messagingEnforcement.source }
        : {}),
    });
  }

  const account = await getWhatsAppAccount(channel.tenantId, channel.accountId);
  if (isAccountOutboundBlocked(account)) {
    throwBlocked({
      phoneNumberId,
      kind,
      reason: account?.messagingEnforcement?.reason ?? "waba_blocked",
      ...(account?.messagingEnforcement?.source
        ? { enforcementSource: account.messagingEnforcement.source }
        : {}),
    });
  }

  if (kind === "marketing" && channel.qualitySnapshot?.risk === "block") {
    throwBlocked({
      phoneNumberId,
      kind,
      reason: "quality_snapshot_block",
    });
  }
}

export async function assertWhatsAppOutboundAllowed(params: {
  tenantId: string;
  phoneNumberId: string;
  kind: WhatsAppOutboundSendKind;
  to?: string;
  requireOptIn?: boolean;
}): Promise<WhatsAppChannel | null> {
  const { tenantId, phoneNumberId, kind } = params;
  const requireOptIn = params.requireOptIn ?? kind === "marketing";

  const channel = await getWhatsAppChannelByPhoneNumberId(phoneNumberId);
  if (channel) {
    if (channel.tenantId !== tenantId) {
      throwBlocked({ phoneNumberId, kind, reason: "channel_tenant_mismatch" });
    }
    await assertEnforcementForChannel(channel, phoneNumberId, kind);
  }

  if (kind === "marketing") {
    await assertMarketingRecipient(tenantId, params.to, requireOptIn);
  }

  return channel;
}
