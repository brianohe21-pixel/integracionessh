import { resolveCloudApiPhoneNumber } from "./embedded-signup.js";
import type { WabaPhoneNumberEntry } from "./client.js";

describe("resolveCloudApiPhoneNumber", () => {
  const phoneA: WabaPhoneNumberEntry = { id: "phone-a", displayPhoneNumber: "+111" };
  const phoneB: WabaPhoneNumberEntry = { id: "phone-b", displayPhoneNumber: "+222" };

  it("resolves by hint id", () => {
    const result = resolveCloudApiPhoneNumber([phoneA, phoneB], "phone-b");
    expect(result?.id).toBe("phone-b");
  });

  it("resolves a single number without hint", () => {
    const result = resolveCloudApiPhoneNumber([phoneA]);
    expect(result?.id).toBe("phone-a");
  });

  it("returns null when no numbers exist", () => {
    expect(resolveCloudApiPhoneNumber([])).toBeNull();
  });

  it("throws when multiple numbers exist without hint", () => {
    expect(() => resolveCloudApiPhoneNumber([phoneA, phoneB])).toThrow(
      /Multiple phone numbers found/
    );
  });
});
