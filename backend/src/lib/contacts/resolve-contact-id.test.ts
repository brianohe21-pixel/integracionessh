import {
  contactIdFromPhone,
  contactIdFromEmail,
  contactIdFromChannelParticipant,
  resolveContactId,
} from "./resolve-contact-id.js";
import { getContactByEmail } from "../dynamodb/contact.repository.js";

jest.mock("../dynamodb/contact.repository.js", () => ({
  ...jest.requireActual("../dynamodb/contact.repository.js"),
  getContactByEmail: jest.fn(),
}));

const getContactByEmailMock = getContactByEmail as jest.MockedFunction<typeof getContactByEmail>;

describe("resolveContactId", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses phone for WhatsApp participants", async () => {
    const id = await resolveContactId({
      tenantId: "tenant-1",
      channel: "whatsapp",
      participantId: "+573001112233",
    });
    expect(id).toBe("phone:573001112233");
  });

  it("uses phone for phone channel calls", async () => {
    const id = await resolveContactId({
      tenantId: "tenant-1",
      channel: "phone",
      participantId: "+573001112233",
    });
    expect(id).toBe("phone:573001112233");
  });

  it("links email to known contact phone", async () => {
    getContactByEmailMock.mockResolvedValue({
      phoneNumber: "573001112233",
      tenantId: "tenant-1",
      tags: [],
      marketingConsent: "unknown",
      suppressed: false,
      firstSeenAt: "",
      lastSeenAt: "",
      source: "sync",
      createdAt: "",
      updatedAt: "",
    });

    const id = await resolveContactId({
      tenantId: "tenant-1",
      channel: "email",
      participantId: "client@example.com",
    });
    expect(id).toBe("phone:573001112233");
  });

  it("uses email prefix for unknown email contacts", async () => {
    getContactByEmailMock.mockResolvedValue(null);

    const id = await resolveContactId({
      tenantId: "tenant-1",
      channel: "email",
      participantId: "Client@Example.com",
    });
    expect(id).toBe("email:client@example.com");
  });

  it("falls back to channel participant for anonymous webchat", async () => {
    const id = await resolveContactId({
      tenantId: "tenant-1",
      channel: "webchat",
      participantId: "session-abc",
    });
    expect(id).toBe("webchat:session-abc");
  });
});

describe("contactId helpers", () => {
  it("normalizes phone contact ids", () => {
    expect(contactIdFromPhone("+57 300 111 2233")).toBe("phone:573001112233");
    expect(contactIdFromPhone("123")).toBeNull();
  });

  it("normalizes email contact ids", () => {
    expect(contactIdFromEmail("  User@Mail.COM ")).toBe("email:user@mail.com");
  });

  it("builds channel participant ids", () => {
    expect(contactIdFromChannelParticipant("voicebot", "visitor-1")).toBe("voicebot:visitor-1");
  });
});
