import { checkMarketingRecipients } from "./recipient-policy.js";
import { getContactsByPhones } from "../dynamodb/contact.repository.js";

jest.mock("../dynamodb/contact.repository.js", () => ({
  getContactsByPhones: jest.fn(),
  normalizePhone: jest.fn((p) => String(p).replace(/\D/g, "")),
}));

jest.mock("./audit-log.js", () => ({
  writeComplianceLog: jest.fn().mockResolvedValue(undefined),
}));

const mockedGetContacts = getContactsByPhones as jest.MockedFunction<typeof getContactsByPhones>;

describe("checkMarketingRecipients", () => {
  beforeEach(() => {
    mockedGetContacts.mockReset();
  });

  it("allows opt_in non-suppressed contacts", async () => {
    mockedGetContacts.mockResolvedValue(
      new Map([
        [
          "573001234567",
          {
            phoneNumber: "573001234567",
            tenantId: "t1",
            tags: [],
            marketingConsent: "opt_in",
            suppressed: false,
            firstSeenAt: "",
            lastSeenAt: "",
            source: "sync",
            createdAt: "",
            updatedAt: "",
          },
        ],
      ])
    );

    const result = await checkMarketingRecipients("t1", ["573001234567"]);
    expect(result.allowed).toEqual(["573001234567"]);
    expect(result.blocked).toHaveLength(0);
  });

  it("blocks suppressed contacts", async () => {
    mockedGetContacts.mockResolvedValue(
      new Map([
        [
          "573001234567",
          {
            phoneNumber: "573001234567",
            tenantId: "t1",
            tags: [],
            marketingConsent: "opt_in",
            suppressed: true,
            firstSeenAt: "",
            lastSeenAt: "",
            source: "sync",
            createdAt: "",
            updatedAt: "",
          },
        ],
      ])
    );

    const result = await checkMarketingRecipients("t1", ["573001234567"]);
    expect(result.allowed).toHaveLength(0);
    expect(result.blocked[0]?.reason).toBe("suppressed");
  });

  it("blocks unknown consent when contact missing", async () => {
    mockedGetContacts.mockResolvedValue(new Map());

    const result = await checkMarketingRecipients("t1", ["573009999999"]);
    expect(result.blocked[0]?.reason).toBe("unknown_consent");
  });
});
