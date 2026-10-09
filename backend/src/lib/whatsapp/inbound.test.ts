import { isProcessableInboundMessage, normalizeInboundMessage, extractInboundReaction } from "./inbound.js";

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

  it("normalizes order messages", () => {
    const result = normalizeInboundMessage({
      from: "57300",
      id: "m4",
      timestamp: "1",
      type: "order",
      order: {
        catalog_id: "cat-1",
        text: "Sin cebolla",
        product_items: [
          {
            product_retailer_id: "sku-1",
            quantity: 2,
            item_price: 15000,
            currency: "COP",
          },
        ],
      },
    });
    expect(result.messageType).toBe("order");
    expect(result.order?.catalog_id).toBe("cat-1");
    expect(result.text).toContain("sku-1");
    expect(result.text).toContain("Sin cebolla");
  });

  it("normalizes image messages with caption", () => {
    const result = normalizeInboundMessage({
      from: "57300",
      id: "m5",
      timestamp: "1",
      type: "image",
      image: {
        id: "media-image-1",
        mime_type: "image/jpeg",
        caption: "Foto del producto",
      },
    });
    expect(result.messageType).toBe("image");
    expect(result.text).toBe("Foto del producto");
  });

  it("normalizes image messages without caption", () => {
    const result = normalizeInboundMessage({
      from: "57300",
      id: "m6",
      timestamp: "1",
      type: "image",
      image: {
        id: "media-image-2",
        mime_type: "image/png",
      },
    });
    expect(result.messageType).toBe("image");
    expect(result.text).toBe("[image]");
  });

  it("normalizes audio messages", () => {
    const result = normalizeInboundMessage({
      from: "57300",
      id: "m7",
      timestamp: "1",
      type: "audio",
      audio: {
        id: "media-audio-1",
        mime_type: "audio/ogg",
      },
    });
    expect(result.messageType).toBe("audio");
    expect(result.text).toBe("[audio]");
  });

  it("normalizes video messages", () => {
    const result = normalizeInboundMessage({
      from: "57300",
      id: "m8",
      timestamp: "1",
      type: "video",
      video: {
        id: "media-video-1",
        mime_type: "video/mp4",
        caption: "mira esto",
      },
    });
    expect(result.messageType).toBe("video");
    expect(result.text).toBe("mira esto");
  });
});

describe("isProcessableInboundMessage", () => {
  it("accepts text, interactive, image and audio", () => {
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
        type: "reaction",
        reaction: { message_id: "wamid.target", emoji: "👍" },
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
    expect(
      isProcessableInboundMessage({
        from: "1",
        id: "1",
        timestamp: "1",
        type: "image",
        image: { id: "media-1", mime_type: "image/jpeg" },
      })
    ).toBe(true);
    expect(
      isProcessableInboundMessage({
        from: "1",
        id: "1",
        timestamp: "1",
        type: "audio",
        audio: { id: "media-2", mime_type: "audio/ogg" },
      })
    ).toBe(true);
    expect(
      isProcessableInboundMessage({
        from: "1",
        id: "1",
        timestamp: "1",
        type: "video",
        video: { id: "media-3", mime_type: "video/mp4" },
      })
    ).toBe(true);
    expect(
      isProcessableInboundMessage({
        id: "1",
        timestamp: "1",
        type: "system",
        system: {
          type: "user_changed_user_id",
          previous_user_id: "CO.OLD",
          user_id: "CO.NEW",
        },
      })
    ).toBe(true);
    expect(
      isProcessableInboundMessage({
        from: "1",
        id: "1",
        timestamp: "1",
        type: "order",
        order: {
          catalog_id: "cat-1",
          product_items: [
            {
              product_retailer_id: "sku-1",
              quantity: 1,
              item_price: 10000,
              currency: "COP",
            },
          ],
        },
      })
    ).toBe(true);
  });
});

describe("extractInboundReaction", () => {
  it("extracts reaction target and emoji", () => {
    const result = extractInboundReaction({
      from: "57300",
      id: "reaction-1",
      timestamp: "1",
      type: "reaction",
      reaction: { message_id: "wamid.target", emoji: "❤️" },
    });
    expect(result).toEqual({ targetMessageId: "wamid.target", emoji: "❤️" });
  });

  it("returns empty emoji when reaction is removed", () => {
    const result = extractInboundReaction({
      from: "57300",
      id: "reaction-2",
      timestamp: "1",
      type: "reaction",
      reaction: { message_id: "wamid.target", emoji: "" },
    });
    expect(result?.emoji).toBe("");
  });
});
