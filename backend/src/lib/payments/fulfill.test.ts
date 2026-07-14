import { parseTenantPaymentReference } from "./checkout.js";

describe("parseTenantPaymentReference", () => {
  it("returns null for billing references", () => {
    expect(parseTenantPaymentReference("wompi|tenant|pro|abc")).toBeNull();
  });
});
