import { buildEmailMessageMetadata, messageHashFromId } from "./mime.js";
import type { EmailInboundPayload } from "../../types/index.js";

describe("messageHashFromId", () => {
  it("returns stable hash prefix", () => {
    const hash = messageHashFromId("msg-123");
    expect(hash).toHaveLength(24);
    expect(messageHashFromId("msg-123")).toBe(hash);
  });
});

describe("buildEmailMessageMetadata", () => {
  it("maps payload to metadata without s3 keys", () => {
    const payload: EmailInboundPayload = {
      from: "sender@example.com",
      fromName: "Sender",
      to: "inbox@example.com",
      subject: "Hello",
      text: "Body",
      html: "<p>Body</p>",
      messageId: "abc-123",
      attachments: [
        {
          attachmentId: "att-1",
          filename: "file.pdf",
          mimeType: "application/pdf",
          sizeBytes: 100,
          s3Key: "tenants/t/bots/b/email/hash/attachments/att-1/file.pdf",
          disposition: "attachment",
        },
      ],
    };

    const metadata = buildEmailMessageMetadata(payload);
    expect(metadata.kind).toBe("email");
    expect(metadata.subject).toBe("Hello");
    expect(metadata.from).toBe("sender@example.com");
    expect(metadata.hasAttachments).toBe(true);
    expect(metadata.attachments?.[0]).toEqual({
      attachmentId: "att-1",
      filename: "file.pdf",
      mimeType: "application/pdf",
      sizeBytes: 100,
      disposition: "attachment",
    });
    expect(metadata.attachments?.[0]).not.toHaveProperty("s3Key");
  });
});
