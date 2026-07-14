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
