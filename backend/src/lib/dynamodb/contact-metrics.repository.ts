import { listAllContacts } from "./contact.repository.js";
import type { ContactMetrics, MarketingConsent } from "../../types/index.js";

const CONSENT_VALUES: MarketingConsent[] = ["opt_in", "opt_out", "unknown"];

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate()
  );
}

function isThisWeek(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setUTCDate(now.getUTCDate() - 7);
  return d >= weekAgo;
}

export async function getContactMetrics(tenantId: string): Promise<ContactMetrics> {
  const contacts = await listAllContacts(tenantId);

  const byConsent = CONSENT_VALUES.reduce(
    (acc, consent) => {
      acc[consent] = contacts.filter((contact) => contact.marketingConsent === consent).length;
      return acc;
    },
    {} as Record<MarketingConsent, number>
  );

  return {
    total: contacts.length,
    optIn: byConsent.opt_in,
    optOut: byConsent.opt_out,
    unknown: byConsent.unknown,
    suppressed: contacts.filter((contact) => contact.suppressed).length,
    addedToday: contacts.filter((contact) => isToday(contact.createdAt)).length,
    addedThisWeek: contacts.filter((contact) => isThisWeek(contact.createdAt)).length,
    withLead: contacts.filter((contact) => Boolean(contact.leadId)).length,
  };
}
