import { createPrivateKey, sign } from "crypto";
import { parseTelnyxWebhookBody, verifyTelnyxWebhookSignature } from "./webhook.js";

function generateTestKeyPair(): { publicKey: string; privateKey: ReturnType<typeof createPrivateKey> } {
  const { generateKeyPairSync } = require("crypto") as typeof import("crypto");
  const pair = generateKeyPairSync("ed25519");
  const publicKey = pair.publicKey.export({ type: "spki", format: "der" }).toString("base64");
  return { publicKey, privateKey: pair.privateKey };
}

describe("telnyx webhook", () => {
  it("parses single and batched payloads", () => {
    const single = parseTelnyxWebhookBody(
      JSON.stringify({ data: { event_type: "call.initiated", id: "evt-1", payload: {} } })
    );
    expect(single).toHaveLength(1);
    expect(single[0]?.data.event_type).toBe("call.initiated");

    const batch = parseTelnyxWebhookBody(
      JSON.stringify([
        { data: { event_type: "call.answered", id: "evt-2", payload: {} } },
        { data: { event_type: "call.hangup", id: "evt-3", payload: {} } },
      ])
    );
    expect(batch).toHaveLength(2);
  });

  it("verifies valid signatures", () => {
    const { publicKey, privateKey } = generateTestKeyPair();
    const rawBody = JSON.stringify({ data: { id: "evt-1" } });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const payload = `${timestamp}|${rawBody}`;
    const signature = sign(null, Buffer.from(payload), privateKey).toString("base64");

    expect(
      verifyTelnyxWebhookSignature({
        rawBody,
        signature,
        timestamp,
        publicKey,
      })
    ).toBe(true);
  });

  it("rejects invalid signatures", () => {
    expect(
      verifyTelnyxWebhookSignature({
        rawBody: "{}",
        signature: "invalid",
        timestamp: String(Math.floor(Date.now() / 1000)),
        publicKey: "invalid",
      })
    ).toBe(false);
  });
});
