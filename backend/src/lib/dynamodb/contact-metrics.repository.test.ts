import type { Contact } from "../../types/index.js";
import { listAllContacts } from "./contact.repository.js";
import { getContactMetrics } from "./contact-metrics.repository.js";

jest.mock("./contact.repository.js", () => ({
  listAllContacts: jest.fn(),
}));

describe("getContactMetrics", () => {
  beforeEach(() => {
    jest.mocked(listAllContacts).mockReset();
  });

  it("aggregates consent and growth metrics across all contacts", async () => {
    const now = new Date().toISOString();
    const contacts: Contact[] = [
      {
        phoneNumber: "573001234567",
        tenantId: "tenant-1",
        tags: [],
        marketingConsent: "opt_in",
        suppressed: false,
        firstSeenAt: now,
        lastSeenAt: now,
        source: "manual",
        createdAt: now,
        updatedAt: now,
        leadId: "lead-1",
      },
      {
        phoneNumber: "573009876543",
        tenantId: "tenant-1",
        tags: [],
        marketingConsent: "opt_out",
        suppressed: true,
        firstSeenAt: "2020-01-01T00:00:00.000Z",
        lastSeenAt: "2020-01-01T00:00:00.000Z",
        source: "import",
        createdAt: "2020-01-01T00:00:00.000Z",
        updatedAt: "2020-01-01T00:00:00.000Z",
      },
      {
        phoneNumber: "573001112233",
        tenantId: "tenant-1",
        tags: [],
        marketingConsent: "unknown",
        suppressed: false,
        firstSeenAt: now,
        lastSeenAt: now,
        source: "sync",
        createdAt: now,
        updatedAt: now,
      },
    ];
    jest.mocked(listAllContacts).mockResolvedValue(contacts);

    const metrics = await getContactMetrics("tenant-1");

    expect(metrics).toEqual({
      total: 3,
      optIn: 1,
      optOut: 1,
      unknown: 1,
      suppressed: 1,
      addedToday: 2,
      addedThisWeek: 2,
      withLead: 1,
    });
  });
});
