import type { Contact, MailrelayConfig } from "../../types/index.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidMailrelayEmail(value: string | undefined): value is string {
  return typeof value === "string" && value.length <= 254 && EMAIL_PATTERN.test(value.trim());
}

export function groupIdsForContact(contact: Contact, config: MailrelayConfig): number[] {
  const tags = new Set(contact.tags.map((tag) => tag.trim().toLowerCase()));
  const ids = [
    ...config.defaultGroupIds,
    ...config.tagGroupMappings
      .filter((mapping) => tags.has(mapping.tag.trim().toLowerCase()))
      .flatMap((mapping) => mapping.groupIds),
  ];
  return [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
}

export function isMailrelaySyncEligible(contact: Contact): boolean {
  return (
    isValidMailrelayEmail(contact.email) &&
    contact.marketingConsent === "opt_in" &&
    !contact.suppressed
  );
}

export function mapContactToMailrelaySubscriber(
  contact: Contact,
  config: MailrelayConfig
): Record<string, unknown> {
  return {
    email: contact.email?.trim().toLowerCase(),
    status: "active",
    name: contact.displayName ?? "",
    group_ids: groupIdsForContact(contact, config),
    replace_groups: true,
    restore_if_deleted: false,
  };
}
