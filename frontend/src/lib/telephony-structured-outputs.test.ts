import {
  definitionToFormState,
  formStateToDefinition,
  getStructuredOutputExampleFormState,
  parseStructuredOutputJson,
} from "@/lib/telephony-structured-outputs";

describe("structured output form state", () => {
  it("round-trips ai schema through form state", () => {
    const definition = {
      name: "customer_order",
      type: "ai" as const,
      description: "Order details",
      schema: {
        type: "object",
        properties: {
          customer_name: { type: "string", description: "Customer full name" },
          subtotal: { type: "number", description: "Order subtotal" },
          resolved: { type: "boolean", description: "Resolved" },
        },
        required: ["customer_name"],
        additionalProperties: false,
      },
    };

    const formState = definitionToFormState(definition, "ai");
    expect(formState.schemaName).toBe("customer_order");
    expect(formState.description).toBe("Order details");
    expect(formState.fields).toHaveLength(3);
    expect(formState.fields.find((field) => field.name === "customer_name")?.required).toBe(true);

    expect(formStateToDefinition(formState, "ai")).toEqual(definition);
  });

  it("round-trips regex patterns through form state", () => {
    const definition = {
      name: "order_codes",
      type: "regex" as const,
      patterns: {
        order_id: "ORD-\\d+",
        phone_number: "\\+?\\d{10,15}",
      },
    };

    const formState = definitionToFormState(definition, "regex");
    expect(formState.fields).toHaveLength(2);
    expect(formState.fields[0]?.pattern).toBe("ORD-\\d+");

    expect(formStateToDefinition(formState, "regex")).toEqual(definition);
  });

  it("builds example form state", () => {
    const example = getStructuredOutputExampleFormState("ai");
    const definition = formStateToDefinition(example, "ai");
    expect(definition?.name).toBe("customer_order");
    expect(definition?.schema).toMatchObject({
      type: "object",
      properties: expect.objectContaining({
        customer_name: { type: "string", description: "Customer full name" },
      }),
    });
  });

  it("keeps json parsing compatible with form builder output", () => {
    const example = getStructuredOutputExampleFormState("ai");
    const definition = formStateToDefinition(example, "ai");
    const reparsed = parseStructuredOutputJson(JSON.stringify(definition));
    expect(reparsed?.name).toBe("customer_order");
    expect(reparsed?.schema).toEqual(definition?.schema);
  });
});
