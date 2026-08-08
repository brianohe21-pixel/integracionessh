import { extractResponseText, isInboundTelnyxMedia } from "./bridge.js";

describe("telephony bridge", () => {
  it("accepts inbound media and legacy frames without track", () => {
    expect(isInboundTelnyxMedia("inbound")).toBe(true);
    expect(isInboundTelnyxMedia(undefined)).toBe(true);
  });

  it("ignores outbound media echoes", () => {
    expect(isInboundTelnyxMedia("outbound")).toBe(false);
  });

  it("extracts assistant text from response.done payload", () => {
    const text = extractResponseText({
      output: [
        {
          content: [{ type: "text", text: "Hola, ¿en qué puedo ayudarte?" }],
        },
      ],
    });
    expect(text).toBe("Hola, ¿en qué puedo ayudarte?");
  });
});
