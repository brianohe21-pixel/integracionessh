import { beforeEach, describe, expect, it, jest } from "@jest/globals";

jest.mock("../../s3/client.js", () => ({
  getObjectBuffer: jest.fn(),
}));

jest.mock("../../channels/router.js", () => ({
  buildOutboundContext: jest.fn((ctx: unknown) => ctx),
  sendChannelAudio: jest.fn(),
}));

import { getObjectBuffer } from "../../s3/client.js";
import { sendChannelAudio } from "../../channels/router.js";
import { executeSendAudioNode } from "./send-audio.js";
import type { Bot, Conversation, FlowDefinition, FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext } from "../types.js";

const mockedGetObjectBuffer = jest.mocked(getObjectBuffer);
const mockedSendChannelAudio = jest.mocked(sendChannelAudio);

const oggBuffer = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0x00, 0x01]);

const flow: FlowDefinition = {
  flowId: "flow-1",
  tenantId: "tenant-1",
  botId: "bot-1",
  name: "Audio flow",
  enabled: true,
  version: 1,
  nodes: [],
  edges: [{ id: "e1", source: "audio-1", target: "end-1" }],
  entryNodeId: "trigger-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const node: FlowNode = {
  id: "audio-1",
  type: "send_audio",
  position: { x: 0, y: 0 },
  data: {
    label: "Voice note",
    audioS3Key: "tenants/tenant-1/flows/flow-1/media/m1/voice.ogg",
    audioFilename: "voice.ogg",
    audioMimeType: "audio/ogg",
    audioMediaId: "m1",
  },
};

const run: FlowRun = {
  runId: "run-1",
  tenantId: "tenant-1",
  botId: "bot-1",
  flowId: "flow-1",
  conversationId: "conv-1",
  status: "active",
  currentNodeId: "audio-1",
  variables: {},
  stepHistory: [],
  stepCount: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function buildContext(overrides: Partial<FlowExecutionContext> = {}): FlowExecutionContext {
  return {
    mode: "conversation",
    tenantId: "tenant-1",
    botId: "bot-1",
    bot: {
      botId: "bot-1",
      tenantId: "tenant-1",
      name: "Bot",
      status: "active",
      responseMode: "none",
      phoneNumberId: "phone-1",
      whatsappBusinessAccountId: "waba-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } as Bot,
    conversation: {
      conversationId: "conv-1",
      tenantId: "tenant-1",
      botId: "bot-1",
      channel: "whatsapp",
      participantId: "573001234567",
      phoneNumber: "573001234567",
      status: "active",
      messageCount: 1,
      lastMessageAt: "2026-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    } as Conversation,
    phoneNumberId: "phone-1",
    accessToken: "token",
    customerPhone: "573001234567",
    inbound: {
      text: "",
      messageType: "text",
      raw: { from: "573001234567", id: "1", timestamp: "1", type: "text" },
    },
    flow,
    channel: "whatsapp",
    environment: "dev",
    ...overrides,
  };
}

describe("executeSendAudioNode", () => {
  beforeEach(() => {
    mockedGetObjectBuffer.mockReset();
    mockedSendChannelAudio.mockReset();
    mockedGetObjectBuffer.mockResolvedValue(oggBuffer);
    mockedSendChannelAudio.mockResolvedValue({ externalMessageId: "wamid.1" });
  });

  it("sends the uploaded voice note on WhatsApp", async () => {
    const result = await executeSendAudioNode(node, buildContext(), run);

    expect(mockedGetObjectBuffer).toHaveBeenCalledWith(node.data.audioS3Key);
    expect(mockedSendChannelAudio).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        buffer: oggBuffer,
        mimeType: "audio/ogg",
        filename: "voice.ogg",
        voice: true,
      })
    );
    expect(result).toEqual({
      nextNodeId: "end-1",
      halt: false,
      wait: false,
      output: "voice.ogg",
    });
  });

  it("skips on non-WhatsApp channels", async () => {
    const result = await executeSendAudioNode(
      node,
      buildContext({ channel: "webchat" }),
      run
    );

    expect(mockedGetObjectBuffer).not.toHaveBeenCalled();
    expect(mockedSendChannelAudio).not.toHaveBeenCalled();
    expect(result.output).toBe("skipped_send_audio");
    expect(result.nextNodeId).toBe("end-1");
  });

  it("throws when audioS3Key is missing", async () => {
    await expect(
      executeSendAudioNode(
        { ...node, data: { label: "Voice note" } },
        buildContext(),
        run
      )
    ).rejects.toThrow("send_audio requires an uploaded voice note");
  });

  it("throws when buffer is not OGG Opus", async () => {
    mockedGetObjectBuffer.mockResolvedValue(new Uint8Array([0x00, 0x01, 0x02, 0x03]));

    await expect(executeSendAudioNode(node, buildContext(), run)).rejects.toThrow(
      "Voice note must be a valid OGG Opus audio file"
    );
    expect(mockedSendChannelAudio).not.toHaveBeenCalled();
  });
});
