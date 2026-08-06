import { extractSampleFields } from "@/components/flows/FormBindingField";

describe("extractSampleFields", () => {
  it("extracts top-level and nested fields", () => {
    expect(
      extractSampleFields({
        phone: "573001112233",
        name: "Ana",
        contact: { email: "a@b.com" },
      })
    ).toEqual(["phone", "name", "contact.email"]);
  });
});
