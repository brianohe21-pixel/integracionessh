import { beforeEach, describe, expect, it, jest } from "@jest/globals";

jest.mock("../dynamodb/contact.repository.js", () => ({
  getContactByPhone: jest.fn(),
  normalizePhone: (phone: string) => phone.replace(/\D/g, ""),
}));

import { getContactByPhone } from "../dynamodb/contact.repository.js";
import { contactPredatesConversation, resolveIsKnownContact } from "./is-known-contact.js";
import type { Contact } from "../../types/index.js";

const mockedGetContactByPhone = jest.mocked(getContactByPhone);

function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    phoneNumber: "573001112233",
    tenantId: "tenant-1",
    tags: [],
    marketingConsent: "unknown",
    suppressed: false,
    firstSeenAt: "2026-01-01T00:00:00.000Z",
    lastSeenAt: "2026-01-01T00:00:00.000Z",
    source: "manual",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("contactPredatesConversation", () => {
  it("returns true when contact was created before the conversation", () => {
    expect(
      contactPredatesConversation(makeContact({ createdAt: "2026-01-01T00:00:00.000Z" }), {
        createdAt: "2026-10-01T00:00:00.000Z",
      })
    ).toBe(true);
  });

  it("returns false when contact matches the current conversation sync", () => {
    expect(
      contactPredatesConversation(makeContact({ createdAt: "2026-10-01T00:00:01.000Z" }), {
        createdAt: "2026-10-01T00:00:00.000Z",
      })
    ).toBe(false);
  });
});

describe("resolveIsKnownContact", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("marks prior contacts as known", async () => {
    mockedGetContactByPhone.mockResolvedValueOnce(
      makeContact({ createdAt: "2026-01-01T00:00:00.000Z" })
    );

    await expect(
      resolveIsKnownContact({
        tenantId: "tenant-1",
        phone: "573001112233",
        conversation: {
          createdAt: "2026-10-01T00:00:00.000Z",
          phoneNumber: "573001112233",
          participantId: "573001112233",
        },
      })
    ).resolves.toEqual({ isKnown: true, phone: "573001112233" });
  });

  it("does not mark sync contacts from the current conversation as known", async () => {
    mockedGetContactByPhone.mockResolvedValueOnce(
      makeContact({ createdAt: "2026-10-01T00:00:01.000Z", source: "sync" })
    );

    await expect(
      resolveIsKnownContact({
        tenantId: "tenant-1",
        phone: "573001112233",
        conversation: {
          createdAt: "2026-10-01T00:00:00.000Z",
          phoneNumber: "573001112233",
          participantId: "573001112233",
        },
      })
    ).resolves.toEqual({ isKnown: false, phone: "573001112233" });
  });

  it("returns false when contact does not exist", async () => {
    mockedGetContactByPhone.mockResolvedValueOnce(null);

    await expect(
      resolveIsKnownContact({
        tenantId: "tenant-1",
        phone: "573001112233",
      })
    ).resolves.toEqual({ isKnown: false, phone: "573001112233" });
  });
});
