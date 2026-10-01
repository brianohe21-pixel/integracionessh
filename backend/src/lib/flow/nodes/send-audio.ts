import { buildOutboundContext, sendChannelAudio } from "../../channels/router.js";
import { isOggOpusBuffer } from "../../conversations/attachment-policy.js";
import { getObjectBuffer } from "../../s3/client.js";
import type { FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";
import { requireBotContext } from "../types.js";
import { getNextNodeId } from "../graph.js";
import { skipWhatsAppOnlyNode } from "./channel-guard.js";
import { persistFlowOutboundMessage } from "../persist-outbound.js";

export async function executeSendAudioNode(
  node: FlowNode,
  ctx: FlowExecutionContext,
  _run: FlowRun
): Promise<NodeExecutionResult> {
  const skipped = skipWhatsAppOnlyNode(ctx, node.id, "send_audio");
  if (skipped) return skipped;

  const { botId, bot } = requireBotContext(ctx);
  const s3Key = node.data.audioS3Key?.trim();
  if (!s3Key) {
    throw new Error("send_audio requires an uploaded voice note");
  }

  const filename = node.data.audioFilename?.trim() || "voice-note.ogg";
  const mimeType = node.data.audioMimeType?.trim() || "audio/ogg";
  const buffer = await getObjectBuffer(s3Key);
  if (!isOggOpusBuffer(buffer)) {
    throw new Error("Voice note must be a valid OGG Opus audio file");
  }

  const result = await sendChannelAudio(
    buildOutboundContext({
      tenantId: ctx.tenantId,
      botId,
      bot,
      conversation: ctx.conversation!,
      accessToken: ctx.accessToken,
      environment: ctx.environment,
      replyToExternalId: ctx.replyToMessageId,
    }),
    {
      buffer,
      mimeType,
      filename,
      voice: true,
    }
  );

  await persistFlowOutboundMessage({
    ctx,
    content: filename,
    messageType: "audio",
    skipIfAdapterPersists: false,
    ...(result.externalMessageId ? { externalMessageId: result.externalMessageId } : {}),
    metadata: {
      kind: "voice_note",
      filename,
      mimeType,
      ...(s3Key ? { s3Key } : {}),
    },
  });

  return {
    nextNodeId: getNextNodeId(ctx.flow, node.id),
    halt: false,
    wait: false,
    output: filename,
  };
}
