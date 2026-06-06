import { isProcessableInboundMessage, normalizeInboundMessage } from "./inbound.js";

describe("normalizeInboundMessage", () => {
  it("normalizes text messages", () => {
    const result = normalizeInboundMessage({
      from: "57300",
      id: "m1",
      timestamp: "1",
      type: "text",
      text: { body: "hola" },
    });
    expect(result.text).toBe("hola");
    expect(result.messageType).toBe("text");
  });

  it("normalizes button replies", () => {
    const result = normalizeInboundMessage({
      from: "57300",
      id: "m2",
      timestamp: "1",
      type: "interactive",
      interactive: {
        type: "button_reply",
        button_reply: { id: "btn1", title: "Yes" },
      },
    });
    expect(result.text).toBe("Yes");
    expect(result.interactive?.kind).toBe("button");
    expect(result.interactive?.id).toBe("btn1");
  });

  it("normalizes nfm flow replies", () => {
    const result = normalizeInboundMessage({
      from: "57300",
      id: "m3",
      timestamp: "1",
      type: "interactive",
      interactive: {
        type: "nfm_reply",
        nfm_reply: { response_json: '{"name":"Ana","email":"a@test.com"}' },
      },
    });
    expect(result.messageType).toBe("flow_response");
    expect(result.interactive?.responseJson).toContain("Ana");
  });
});

describe("isProcessableInboundMessage", () => {
  it("accepts text and interactive", () => {
    expect(
      isProcessableInboundMessage({
        from: "1",
        id: "1",
        timestamp: "1",
        type: "text",
        text: { body: "x" },
      })
    ).toBe(true);
    expect(
      isProcessableInboundMessage({
        from: "1",
        id: "1",
        timestamp: "1",
        type: "image",
      })
    ).toBe(false);
  });
});
