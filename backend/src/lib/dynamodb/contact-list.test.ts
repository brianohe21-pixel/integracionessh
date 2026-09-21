import type { Contact } from "../../types/index.js";
import { compareContacts, contactMatchesDateRange } from "./contact.repository.js";

function contact(overrides: Partial<Contact> & Pick<Contact, "phoneNumber">): Contact {
  const now = "2026-09-18T12:00:00.000Z";
  return {
    tenantId: "tenant-1",
    tags: [],
    marketingConsent: "unknown",
    suppressed: false,
    firstSeenAt: now,
    lastSeenAt: now,
    source: "manual",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("compareContacts", () => {
  it("sorts by name alphabetically", () => {
    const a = contact({ phoneNumber: "1", displayName: "Ana" });
    const b = contact({ phoneNumber: "2", displayName: "Bruno" });
    expect(compareContacts(a, b, "name")).toBeLessThan(0);
  });

  it("sorts by csat descending", () => {
    const a = contact({ phoneNumber: "1", csatAverage: 3 });
    const b = contact({ phoneNumber: "2", csatAverage: 5 });
    expect(compareContacts(a, b, "csat")).toBeGreaterThan(0);
  });
});

describe("contactMatchesDateRange", () => {
  it("matches contacts inside the selected last seen range", () => {
    const active = contact({
      phoneNumber: "573001234567",
      lastSeenAt: "2026-09-18T12:00:00.000Z",
    });
    const inactive = contact({
      phoneNumber: "573009876543",
      lastSeenAt: "2026-01-01T12:00:00.000Z",
    });

    expect(
      contactMatchesDateRange(active, {
        from: "2026-09-01",
        to: "2026-09-30",
        dateField: "lastSeen",
      })
    ).toBe(true);
    expect(
      contactMatchesDateRange(inactive, {
        from: "2026-09-01",
        to: "2026-09-30",
        dateField: "lastSeen",
      })
    ).toBe(false);
  });
});
