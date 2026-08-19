import {
  parseStructuredOutputJson,
  resolveTelephonyStructuredOutput,
  wrapStructuredOutputResult,
} from "./structured-output-config.js";

describe("parseStructuredOutputJson", () => {
  it("parses schema config", () => {
    expect(
      parseStructuredOutputJson(
        JSON.stringify({
          name: "Customer Info",
          description: "Extract customer contact information",
          schema: {
            type: "object",
            properties: {
              firstName: { type: "string", description: "Customer first name" },
              email: { type: "string", format: "email" },
            },
            required: ["firstName"],
          },
        })
      )
    ).toEqual({
      name: "Customer Info",
      type: "ai",
      description: "Extract customer contact information",
      schema: {
        type: "object",
        properties: {
          firstName: { type: "string", description: "Customer first name" },
          email: { type: "string", format: "email" },
        },
        required: ["firstName"],
      },
    });
  });

  it("parses example result format into schema", () => {
    expect(
      parseStructuredOutputJson(
        JSON.stringify({
          name: "customer_order",
          result: {
            subtotal: 34.98,
            customer_name: "John Smith",
            resolved: true,
          },
        })
      )
    ).toEqual({
      name: "customer_order",
      type: "ai",
      schema: {
        type: "object",
        properties: {
          subtotal: { type: "number", description: "subtotal" },
          customer_name: { type: "string", description: "customer name" },
          resolved: { type: "boolean", description: "resolved" },
        },
        additionalProperties: false,
      },
    });
  });

  it("parses regex config", () => {
    expect(
      parseStructuredOutputJson(
        JSON.stringify({
          name: "order_codes",
          type: "regex",
          patterns: {
            order_id: "ORD-\\d+",
            phone_number: "\\+?\\d{10,15}",
          },
        })
      )
    ).toEqual({
      name: "order_codes",
      type: "regex",
      patterns: {
        order_id: "ORD-\\d+",
        phone_number: "\\+?\\d{10,15}",
      },
    });
  });
});

describe("wrapStructuredOutputResult", () => {
  it("wraps extracted values with schema name", () => {
    expect(
      wrapStructuredOutputResult("customer_order", {
        subtotal: 34.98,
        customer_name: "John Smith",
      })
    ).toEqual({
      name: "customer_order",
      result: { subtotal: 34.98, customer_name: "John Smith" },
    });
  });
});

describe("resolveTelephonyStructuredOutput", () => {
  it("migrates legacy flat fields", () => {
    const definition = resolveTelephonyStructuredOutput({
      botId: "bot-1",
      tenantId: "tenant-1",
      name: "Bot",
      phoneNumberId: "p",
      whatsappBusinessAccountId: "w",
      status: "active",
      createdAt: "",
      updatedAt: "",
      responseMode: "openai",
      telephonyStructuredOutputSchemaName: "customer_order",
      telephonyStructuredOutputs: [
        { name: "subtotal", type: "number", description: "subtotal" },
      ],
    });

    expect(definition?.name).toBe("customer_order");
    expect(definition?.type).toBe("ai");
    expect(definition?.schema).toEqual({
      type: "object",
      properties: {
        subtotal: { type: "number", description: "subtotal" },
      },
      additionalProperties: false,
    });
  });
});
