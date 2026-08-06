import {
  buildBindingContext,
  flattenFormPayload,
  getNestedValue,
  resolveBinding,
  resolveBindingValue,
} from "./binding.js";

describe("flow binding", () => {
  it("resolves nested form bindings", () => {
    const context = buildBindingContext({
      formPayload: { name: "Ana", contact: { phone: "573001112233" } },
    });
    expect(resolveBinding("Hola {{form.name}}", context)).toBe("Hola Ana");
    expect(resolveBindingValue("{{form.contact.phone}}", context)).toBe("573001112233");
  });

  it("returns empty string for missing values", () => {
    const context = buildBindingContext({ formPayload: {} });
    expect(resolveBindingValue("{{form.email}}", context)).toBe("");
  });

  it("flattens nested payload", () => {
    expect(
      flattenFormPayload({
        name: "Ana",
        contact: { phone: "573001112233" },
      })
    ).toEqual({
      "form.name": "Ana",
      "form.contact.phone": "573001112233",
    });
  });

  it("reads nested values", () => {
    expect(getNestedValue({ form: { email: "a@b.com" } }, "form.email")).toBe("a@b.com");
  });
});
