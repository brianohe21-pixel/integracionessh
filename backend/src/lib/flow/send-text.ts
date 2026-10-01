import { sendChannelText } from "../channels/router.js";
import type { OutboundContext, OutboundResult } from "../channels/types.js";
import type { FlowExecutionContext } from "./types.js";
import { persistFlowOutboundMessage } from "./persist-outbound.js";

export async function sendFlowChannelText(
  ctx: FlowExecutionContext,
  outbound: OutboundContext,
  text: string
): Promise<OutboundResult> {
  const result = await sendChannelText(outbound, text);
  await persistFlowOutboundMessage({
    ctx,
    content: text,
    ...(result.externalMessageId ? { externalMessageId: result.externalMessageId } : {}),
  });
  return result;
}
