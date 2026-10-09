import { persistInboundWhatsAppMedia, filenameForInboundMedia } from "./inbound-media.js";
import { downloadWhatsAppMedia } from "./client.js";
import { getPresignedReadUrl, putObjectBuffer } from "../s3/client.js";

jest.mock("./client.js", () => ({
  downloadWhatsAppMedia: jest.fn(),
}));

jest.mock("../s3/client.js", () => ({
  buildConversationAttachmentS3Key: jest.fn(
    (
      tenantId: string,
      botId: string,
      conversationId: string,
      attachmentId: string,
      filename: string
    ) =>
      `tenants/${tenantId}/bots/${botId}/conversations/${conversationId}/attachments/${attachmentId}/${filename}`
  ),
  putObjectBuffer: jest.fn(),
  getPresignedReadUrl: jest.fn(),
}));

const downloadWhatsAppMediaMock = jest.mocked(downloadWhatsAppMedia);
const putObjectBufferMock = jest.mocked(putObjectBuffer);
const getPresignedReadUrlMock = jest.mocked(getPresignedReadUrl);

describe("filenameForInboundMedia", () => {
  it("maps common image, audio and video mime types", () => {
    expect(filenameForInboundMedia("image", "image/jpeg")).toBe("image.jpg");
    expect(filenameForInboundMedia("image", "image/png")).toBe("image.png");
    expect(filenameForInboundMedia("audio", "audio/ogg; codecs=opus")).toBe("audio.ogg");
    expect(filenameForInboundMedia("audio", "audio/mpeg")).toBe("audio.mp3");
    expect(filenameForInboundMedia("video", "video/mp4")).toBe("video.mp4");
    expect(filenameForInboundMedia("video", "video/3gpp")).toBe("video.3gp");
  });
});

describe("persistInboundWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    downloadWhatsAppMediaMock.mockResolvedValue({
      buffer: new Uint8Array([1, 2, 3]),
      mimeType: "image/jpeg",
    });
    putObjectBufferMock.mockResolvedValue(undefined);
    getPresignedReadUrlMock.mockResolvedValue("https://example.com/media");
  });

  it("downloads image media and stores it in S3", async () => {
    const result = await persistInboundWhatsAppMedia({
      tenantId: "t-1",
      botId: "b-1",
      conversationId: "c-1",
      accessToken: "token",
      message: {
        from: "57300",
        id: "wamid.1",
        timestamp: "1",
        type: "image",
        image: {
          id: "media-image-1",
          mime_type: "image/jpeg",
          caption: "hola",
        },
      },
    });

    expect(downloadWhatsAppMediaMock).toHaveBeenCalledWith("media-image-1", "token");
    expect(putObjectBufferMock).toHaveBeenCalled();
    expect(result).toMatchObject({
      kind: "image",
      filename: "image.jpg",
      mimeType: "image/jpeg",
      downloadUrl: "https://example.com/media",
    });
    expect(result?.s3Key).toContain("/attachments/");
    expect(result?.s3Key).toContain("image.jpg");
  });

  it("downloads audio media and stores it in S3", async () => {
    downloadWhatsAppMediaMock.mockResolvedValue({
      buffer: new Uint8Array([9, 8, 7]),
      mimeType: "audio/ogg; codecs=opus",
    });

    const result = await persistInboundWhatsAppMedia({
      tenantId: "t-1",
      botId: "b-1",
      conversationId: "c-1",
      accessToken: "token",
      message: {
        from: "57300",
        id: "wamid.2",
        timestamp: "1",
        type: "audio",
        audio: {
          id: "media-audio-1",
          mime_type: "audio/ogg",
        },
      },
    });

    expect(downloadWhatsAppMediaMock).toHaveBeenCalledWith("media-audio-1", "token");
    expect(result).toMatchObject({
      kind: "audio",
      filename: "audio.ogg",
      mimeType: "audio/ogg",
      downloadUrl: "https://example.com/media",
    });
  });

  it("downloads video media and stores it in S3", async () => {
    downloadWhatsAppMediaMock.mockResolvedValue({
      buffer: new Uint8Array([4, 5, 6]),
      mimeType: "video/mp4",
    });

    const result = await persistInboundWhatsAppMedia({
      tenantId: "t-1",
      botId: "b-1",
      conversationId: "c-1",
      accessToken: "token",
      message: {
        from: "57300",
        id: "wamid.video",
        timestamp: "1",
        type: "video",
        video: {
          id: "media-video-1",
          mime_type: "video/mp4",
          caption: "clip",
        },
      },
    });

    expect(downloadWhatsAppMediaMock).toHaveBeenCalledWith("media-video-1", "token");
    expect(result).toMatchObject({
      kind: "video",
      filename: "video.mp4",
      mimeType: "video/mp4",
      downloadUrl: "https://example.com/media",
    });
  });

  it("returns null for non-media messages", async () => {
    const result = await persistInboundWhatsAppMedia({
      tenantId: "t-1",
      botId: "b-1",
      conversationId: "c-1",
      accessToken: "token",
      message: {
        from: "57300",
        id: "wamid.3",
        timestamp: "1",
        type: "text",
        text: { body: "hola" },
      },
    });

    expect(result).toBeNull();
    expect(downloadWhatsAppMediaMock).not.toHaveBeenCalled();
  });
});
