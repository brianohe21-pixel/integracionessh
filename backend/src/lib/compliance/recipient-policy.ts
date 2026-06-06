import { getContactsByPhones, normalizePhone } from "../dynamodb/contact.repository.js";
import { writeComplianceLog } from "./audit-log.js";

export type BlockReason = "suppressed" | "no_opt_in" | "opt_out" | "unknown_consent";

export interface BlockedRecipient {
  phone: string;
  reason: BlockReason;
}

export interface MarketingSendCheckResult {
  allowed: string[];
  blocked: BlockedRecipient[];
}

function blockReasonForContact(
  contact: { suppressed: boolean; marketingConsent: string } | undefined
): BlockReason | null {
  if (!contact) return "unknown_consent";
  if (contact.suppressed) return "suppressed";
  if (contact.marketingConsent === "opt_out") return "opt_out";
  if (contact.marketingConsent !== "opt_in") return "unknown_consent";
  return null;
}

export async function checkMarketingRecipients(
  tenantId: string,
  phones: string[],
  actorUserId?: string
): Promise<MarketingSendCheckResult> {
  const normalized = [...new Set(phones.map(normalizePhone))];
  const contactMap = await getContactsByPhones(tenantId, normalized);

  const allowed: string[] = [];
  const blocked: BlockedRecipient[] = [];

  for (const phone of normalized) {
    const contact = contactMap.get(phone);
    const reason = blockReasonForContact(contact);
    if (reason) {
      blocked.push({ phone, reason });
      await writeComplianceLog({
        tenantId,
        action: "marketing_blocked",
        phone,
        reason,
        ...(actorUserId ? { actorUserId } : {}),
      }).catch((err) => console.warn("Compliance log failed:", err));
    } else {
      allowed.push(phone);
    }
  }

  return { allowed, blocked };
}

export async function assertCanSendMarketing(
  tenantId: string,
  phones: string[],
  actorUserId?: string
): Promise<MarketingSendCheckResult> {
  const result = await checkMarketingRecipients(tenantId, phones, actorUserId);
  return result;
}
