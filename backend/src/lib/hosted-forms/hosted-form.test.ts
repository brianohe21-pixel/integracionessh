import { buildPublicFormUrl, generateFormPublicKey } from "./public-link.js";
import {
  defaultCrmMapping,
  defaultHostedFormFields,
  mappedCrmValues,
  validateAndNormalizeSubmission,
  validateFormDefinition,
} from "./validate.js";
import type { HostedFormField } from "../../types/index.js";

describe("hosted form public link", () => {
  const originalFrontendUrl = process.env.FRONTEND_URL;

  afterEach(() => {
    if (originalFrontendUrl === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = originalFrontendUrl;
  });

  it("generates frm_ prefixed keys", () => {
    expect(generateFormPublicKey().startsWith("frm_")).toBe(true);
  });

  it("builds the public page url", () => {
    process.env.FRONTEND_URL = "https://app.example.com/";
    expect(buildPublicFormUrl("frm_test")).toBe("https://app.example.com/f/frm_test");
  });
});

describe("hosted form validation", () => {
  const fields: HostedFormField[] = [
    { id: "1", type: "text", name: "name", label: "Name", required: true },
    { id: "2", type: "email", name: "email", label: "Email", required: true },
    { id: "3", type: "phone", name: "phone", label: "Phone", required: true },
    {
      id: "4",
      type: "select",
      name: "source",
      label: "Source",
      required: false,
      options: [
        { value: "web", label: "Web" },
        { value: "ads", label: "Ads" },
      ],
    },
  ];

  it("creates default fields with unique names", () => {
    const defaults = defaultHostedFormFields();
    const names = defaults.map((field) => field.name);
    expect(new Set(names).size).toBe(names.length);
    expect(defaultCrmMapping()).toEqual({ name: "name", email: "email", phone: "phone" });
  });

  it("rejects duplicate field names", () => {
    expect(() =>
      validateFormDefinition({
        fields: [
          { id: "a", type: "text", name: "name", label: "Name", required: true },
          { id: "b", type: "text", name: "name", label: "Other", required: false },
        ],
        crmMapping: {},
        createLeadOnSubmit: false,
      })
    ).toThrow("Duplicate field name");
  });

  it("requires a bot and phone mapping to create leads", () => {
    expect(() =>
      validateFormDefinition({
        fields,
        crmMapping: { phone: "phone" },
        createLeadOnSubmit: true,
      })
    ).toThrow("A bot is required");
  });

  it("normalizes a valid submission and maps CRM fields", () => {
    const payload = validateAndNormalizeSubmission(fields, {
      name: "Ada Lovelace",
      email: "ada@example.com",
      phone: "+57 300 123 4567",
      source: "web",
      extra: "ignored",
    });
    expect(payload).toEqual({
      name: "Ada Lovelace",
      email: "ada@example.com",
      phone: "573001234567",
      source: "web",
    });
    expect(mappedCrmValues({ name: "name", email: "email", phone: "phone" }, payload)).toEqual({
      name: "Ada Lovelace",
      email: "ada@example.com",
      phone: "573001234567",
    });
  });

  it("rejects invalid emails", () => {
    expect(() =>
      validateAndNormalizeSubmission(fields, {
        name: "Ada",
        email: "not-an-email",
        phone: "3001234567",
      })
    ).toThrow("valid email");
  });
});
