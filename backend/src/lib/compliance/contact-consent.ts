import { writeComplianceLog } from "./audit-log.js";
import {
  createContact,
  getContactByPhone,
  normalizePhone,
  updateContact,
} from "../dynamodb/contact.repository.js";
import type { ConsentSource, MarketingConsent } from "../../types/index.js";

export async function applyMarketingConsent(params: {
  tenantId: string;
  phone: string;
  marketingConsent: MarketingConsent;
  consentSource: ConsentSource;
  botId?: string;
  displayName?: string;
}): Promise<void> {
  const normalized = normalizePhone(params.phone);
  if (normalized.length < 10) return;
  if (params.marketingConsent === "unknown") return;

  const now = new Date().toISOString();
  const existing = await getContactByPhone(params.tenantId, normalized);

  if (existing) {
    await updateContact(params.tenantId, normalized, {
      marketingConsent: params.marketingConsent,
      consentAt: now,
      consentSource: params.consentSource,
      ...(params.marketingConsent === "opt_out"
        ? { suppressed: true }
        : params.marketingConsent === "opt_in"
          ? { suppressed: false }
          : {}),
      ...(params.botId ? { lastBotId: params.botId } : {}),
    });
  } else {
    await createContact({
      phoneNumber: normalized,
      tenantId: params.tenantId,
      tags: [],
      marketingConsent: params.marketingConsent,
      suppressed: params.marketingConsent === "opt_out",
      firstSeenAt: now,
      lastSeenAt: now,
      source: "sync",
      createdAt: now,
      updatedAt: now,
      consentAt: now,
      consentSource: params.consentSource,
      ...(params.displayName ? { displayName: params.displayName } : {}),
      ...(params.botId ? { lastBotId: params.botId } : {}),
    });
  }

  await writeComplianceLog({
    tenantId: params.tenantId,
    action: "consent_updated",
    phone: normalized,
    reason: params.marketingConsent,
  });

  if (params.marketingConsent === "opt_out") {
    await writeComplianceLog({
      tenantId: params.tenantId,
      action: "suppressed",
      phone: normalized,
      reason: params.consentSource,
    });
  }
}
