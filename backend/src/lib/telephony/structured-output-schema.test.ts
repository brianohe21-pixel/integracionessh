import {
  buildStructuredOutputBotUpdates,
  parseStructuredOutputDefinitionInput,
} from "./structured-output-schema.js";

describe("structured-output-schema", () => {
  it("parses example result format", () => {
    expect(
      parseStructuredOutputDefinitionInput({
        name: "customer_order",
        type: "ai",
        result: {
          subtotal: 34.98,
          nombre_cliente: "Daniel Salcedo",
        },
      })
    ).toEqual({
      name: "customer_order",
      type: "ai",
      schema: {
        type: "object",
        properties: {
          subtotal: { type: "number", description: "subtotal" },
          nombre_cliente: { type: "string", description: "nombre cliente" },
        },
        additionalProperties: false,
      },
    });
  });

  it("builds bot updates that clear legacy fields", () => {
    expect(buildStructuredOutputBotUpdates(null)).toEqual({
      telephonyStructuredOutput: null,
      telephonyStructuredOutputs: null,
      telephonyStructuredOutputSchemaName: null,
    });
  });
});
