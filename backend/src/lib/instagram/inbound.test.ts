import { isProcessableInstagramMessage, normalizeInstagramMessage } from "./inbound.js";

describe("isProcessableInstagramMessage", () => {
  it("rejects echo messages", () => {
    expect(isProcessableInstagramMessage({ mid: "1", text: "hi", is_echo: true })).toBe(false);
  });

  it("accepts text and image attachments", () => {
    expect(isProcessableInstagramMessage({ mid: "1", text: "hola" })).toBe(true);
    expect(
      isProcessableInstagramMessage({
        mid: "2",
        attachments: [{ type: "image", payload: { url: "https://cdn.example/a.jpg" } }],
      })
    ).toBe(true);
  });
});

describe("normalizeInstagramMessage", () => {
  it("normalizes text and media", () => {
    expect(normalizeInstagramMessage({ mid: "1", text: "hola" })).toMatchObject({
      text: "hola",
      messageType: "text",
    });
    expect(
      normalizeInstagramMessage({
        mid: "2",
        attachments: [{ type: "audio", payload: { url: "https://cdn.example/a.ogg" } }],
      })
    ).toMatchObject({
      text: "[audio] https://cdn.example/a.ogg",
      messageType: "text",
    });
  });
});
