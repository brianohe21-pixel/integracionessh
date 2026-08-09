import type { Contact, MailrelayConfig } from "../../types/index.js";
import {
  groupIdsForContact,
  isMailrelaySyncEligible,
  mapContactToMailrelaySubscriber,
} from "./mapping.js";

const contact: Contact = {
  tenantId: "tenant-1",
  phoneNumber: "15551234567",
  email: " Person@Example.com ",
  displayName: "Person",
  tags: ["VIP", "Customer"],
  marketingConsent: "opt_in",
  suppressed: false,
  firstSeenAt: "2026-01-01T00:00:00.000Z",
  lastSeenAt: "2026-01-01T00:00:00.000Z",
  source: "manual",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const config: MailrelayConfig = {
  tenantId: "tenant-1",
  enabled: true,
  defaultGroupIds: [1],
  tagGroupMappings: [
    { tag: "vip", groupIds: [2, 3] },
    { tag: "customer", groupIds: [3, 4] },
  ],
  eventTypes: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("Mailrelay contact mapping", () => {
  it("filters contacts by email, consent and suppression", () => {
    expect(isMailrelaySyncEligible(contact)).toBe(true);
    expect(isMailrelaySyncEligible({ ...contact, marketingConsent: "opt_out" })).toBe(false);
    expect(isMailrelaySyncEligible({ ...contact, suppressed: true })).toBe(false);
    expect(isMailrelaySyncEligible({ ...contact, email: "invalid" })).toBe(false);
  });

  it("maps tags to unique group ids", () => {
    expect(groupIdsForContact(contact, config)).toEqual([1, 2, 3, 4]);
    expect(mapContactToMailrelaySubscriber(contact, config)).toEqual({
      email: "person@example.com",
      status: "active",
      name: "Person",
      group_ids: [1, 2, 3, 4],
      replace_groups: true,
      restore_if_deleted: false,
    });
  });
});
