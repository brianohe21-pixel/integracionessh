import {
  CONVERSATION_ATTACHMENT_MAX_BYTES,
  inferConversationAttachmentMimeType,
  isAllowedConversationAttachmentFilename,
  isAllowedConversationAttachmentMimeType,
  isAudioAttachmentMimeType,
  isImageAttachmentMimeType,
  isOggOpusBuffer,
  isVideoAttachmentMimeType,
  isVoiceNoteMimeType,
  normalizeConversationAttachmentMimeType,
} from "./attachment-policy.js";

describe("attachment-policy", () => {
  it("allows pdf, image, audio and video mime types", () => {
    expect(isAllowedConversationAttachmentMimeType("application/pdf")).toBe(true);
    expect(isAllowedConversationAttachmentMimeType("image/jpeg")).toBe(true);
    expect(isAllowedConversationAttachmentMimeType("image/png")).toBe(true);
    expect(isAllowedConversationAttachmentMimeType("image/webp")).toBe(true);
    expect(isAllowedConversationAttachmentMimeType("audio/mpeg")).toBe(true);
    expect(isAllowedConversationAttachmentMimeType("audio/mp4")).toBe(true);
    expect(isAllowedConversationAttachmentMimeType("audio/aac")).toBe(true);
    expect(isAllowedConversationAttachmentMimeType("audio/amr")).toBe(true);
    expect(isAllowedConversationAttachmentMimeType("audio/ogg")).toBe(true);
    expect(isAllowedConversationAttachmentMimeType("video/mp4")).toBe(true);
    expect(isAllowedConversationAttachmentMimeType("video/3gpp")).toBe(true);
    expect(isAllowedConversationAttachmentMimeType("audio/webm")).toBe(false);
    expect(isAllowedConversationAttachmentMimeType("audio/wav")).toBe(false);
    expect(isAllowedConversationAttachmentMimeType("application/zip")).toBe(false);
  });

  it("validates filenames", () => {
    expect(isAllowedConversationAttachmentFilename("invoice.pdf")).toBe(true);
    expect(isAllowedConversationAttachmentFilename("photo.jpg")).toBe(true);
    expect(isAllowedConversationAttachmentFilename("voice.ogg")).toBe(true);
    expect(isAllowedConversationAttachmentFilename("track.mp3")).toBe(true);
    expect(isAllowedConversationAttachmentFilename("note.m4a")).toBe(true);
    expect(isAllowedConversationAttachmentFilename("clip.mp4")).toBe(true);
    expect(isAllowedConversationAttachmentFilename("clip.3gp")).toBe(true);
    expect(isAllowedConversationAttachmentFilename("clip.wav")).toBe(false);
    expect(isAllowedConversationAttachmentFilename("script.exe")).toBe(false);
  });

  it("infers mime type from filename", () => {
    expect(inferConversationAttachmentMimeType("file.pdf", "application/octet-stream")).toBe(
      "application/pdf"
    );
    expect(inferConversationAttachmentMimeType("photo.png", "")).toBe("image/png");
    expect(inferConversationAttachmentMimeType("clip.mp4", "")).toBe("video/mp4");
  });

  it("detects image attachments", () => {
    expect(isImageAttachmentMimeType("image/jpeg")).toBe(true);
    expect(isImageAttachmentMimeType("application/pdf")).toBe(false);
  });

  it("detects audio attachments and voice notes", () => {
    expect(isAudioAttachmentMimeType("audio/mpeg")).toBe(true);
    expect(isAudioAttachmentMimeType("audio/ogg; codecs=opus")).toBe(true);
    expect(isAudioAttachmentMimeType("audio/webm")).toBe(false);
    expect(isVoiceNoteMimeType("audio/ogg")).toBe(true);
    expect(isVoiceNoteMimeType("audio/ogg; codecs=opus")).toBe(true);
    expect(isVoiceNoteMimeType("audio/mpeg")).toBe(false);
    expect(normalizeConversationAttachmentMimeType("audio/ogg; codecs=opus")).toBe("audio/ogg");
    expect(isOggOpusBuffer(new Uint8Array([0x4f, 0x67, 0x67, 0x53]))).toBe(true);
  });

  it("detects video attachments", () => {
    expect(isVideoAttachmentMimeType("video/mp4")).toBe(true);
    expect(isVideoAttachmentMimeType("video/3gpp")).toBe(true);
    expect(isVideoAttachmentMimeType("video/webm")).toBe(false);
    expect(isVideoAttachmentMimeType("audio/mp4")).toBe(false);
  });

  it("defines max size", () => {
    expect(CONVERSATION_ATTACHMENT_MAX_BYTES).toBe(16 * 1024 * 1024);
  });
});
