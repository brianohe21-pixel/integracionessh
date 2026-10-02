import {
  buildBindingContext,
  conversationBindingFromContext,
  flattenFormPayload,
  getNestedValue,
  resolveBinding,
  resolveBindingValue,
  resolveContactIdentity,
  resolveNormalizedContactPhone,
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

  it("exposes WhatsApp conversation phone and name as bindings", () => {
    const context = buildBindingContext({
      conversation: {
        phone: "573001112233",
        contactName: "Ana Pérez",
      },
    });
    expect(resolveBindingValue("{{phone}}", context)).toBe("573001112233");
    expect(resolveBindingValue("{{contact_phone}}", context)).toBe("573001112233");
    expect(resolveBindingValue("{{contact_name}}", context)).toBe("Ana Pérez");
    expect(resolveBindingValue("{{name}}", context)).toBe("Ana Pérez");
  });

  it("lets explicit variables override conversation defaults", () => {
    const context = buildBindingContext({
      conversation: { phone: "573001112233", contactName: "Ana" },
      variables: { phone: "57000999888", name: "Otro" },
    });
    expect(resolveBindingValue("{{phone}}", context)).toBe("57000999888");
    expect(resolveBindingValue("{{name}}", context)).toBe("Otro");
    expect(resolveBindingValue("{{contact_name}}", context)).toBe("Ana");
  });

  it("ignores BSUID phone variables and keeps conversation phone", () => {
    const context = buildBindingContext({
      conversation: { phone: "573001112233", contactName: "Ana" },
      variables: { phone: "CO.1776217717045877", contact_phone: "CO.1776217717045877" },
    });
    expect(resolveBindingValue("{{phone}}", context)).toBe("573001112233");
    expect(resolveBindingValue("{{contact_phone}}", context)).toBe("573001112233");
  });
});

describe("resolveNormalizedContactPhone", () => {
  it("accepts E.164-like phones", () => {
    expect(resolveNormalizedContactPhone("+57 300 111 2233")).toBe("573001112233");
  });

  it("rejects WhatsApp BSUIDs", () => {
    expect(resolveNormalizedContactPhone("CO.1776217717045877")).toBeNull();
    expect(resolveNormalizedContactPhone("GB.1824521565319420")).toBeNull();
  });
});

describe("conversationBindingFromContext", () => {
  it("prefers conversation phoneNumber over BSUID customerPhone", () => {
    expect(
      conversationBindingFromContext({
        customerPhone: "CO.2936076990083649",
        conversation: {
          phoneNumber: "573015094213",
          participantId: "CO.2936076990083649",
          contactName: "Oscar",
        },
      })
    ).toEqual({ phone: "573015094213", contactName: "Oscar" });
  });

  it("returns BSUID when no phone is available", () => {
    expect(
      conversationBindingFromContext({
        customerPhone: "CO.2936076990083649",
        conversation: {
          participantId: "CO.2936076990083649",
          whatsappUserId: "CO.2936076990083649",
        },
      })
    ).toEqual({ phone: "CO.2936076990083649" });
  });
});

describe("resolveContactIdentity", () => {
  it("accepts phones and BSUIDs", () => {
    expect(resolveContactIdentity("+57 300 111 2233")).toBe("573001112233");
    expect(resolveContactIdentity("CO.1776217717045877")).toBe("CO.1776217717045877");
  });
});
