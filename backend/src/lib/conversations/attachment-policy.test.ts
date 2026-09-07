import {
  CONVERSATION_ATTACHMENT_MAX_BYTES,
  inferConversationAttachmentMimeType,
  isAllowedConversationAttachmentFilename,
  isAllowedConversationAttachmentMimeType,
  isImageAttachmentMimeType,
} from "./attachment-policy.js";

describe("attachment-policy", () => {
  it("allows pdf and common image mime types", () => {
    expect(isAllowedConversationAttachmentMimeType("application/pdf")).toBe(true);
    expect(isAllowedConversationAttachmentMimeType("image/jpeg")).toBe(true);
    expect(isAllowedConversationAttachmentMimeType("image/png")).toBe(true);
    expect(isAllowedConversationAttachmentMimeType("image/webp")).toBe(true);
    expect(isAllowedConversationAttachmentMimeType("application/zip")).toBe(false);
  });

  it("validates filenames", () => {
    expect(isAllowedConversationAttachmentFilename("invoice.pdf")).toBe(true);
    expect(isAllowedConversationAttachmentFilename("photo.jpg")).toBe(true);
    expect(isAllowedConversationAttachmentFilename("script.exe")).toBe(false);
  });

  it("infers mime type from filename", () => {
    expect(inferConversationAttachmentMimeType("file.pdf", "application/octet-stream")).toBe(
      "application/pdf"
    );
    expect(inferConversationAttachmentMimeType("photo.png", "")).toBe("image/png");
  });

  it("detects image attachments", () => {
    expect(isImageAttachmentMimeType("image/jpeg")).toBe(true);
    expect(isImageAttachmentMimeType("application/pdf")).toBe(false);
  });

  it("defines max size", () => {
    expect(CONVERSATION_ATTACHMENT_MAX_BYTES).toBe(16 * 1024 * 1024);
  });
});
