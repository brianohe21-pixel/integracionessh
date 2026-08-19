import { resolveCoexistencePhoneNumber } from "../embedded-signup.js";
import type { WabaPhoneNumberEntry } from "../client.js";

describe("resolveCoexistencePhoneNumber", () => {
  const coexistenceNumber: WabaPhoneNumberEntry = {
    id: "phone-1",
    isOnBizApp: true,
    platformType: "CLOUD_API",
  };

  const otherNumber: WabaPhoneNumberEntry = {
    id: "phone-2",
    isOnBizApp: false,
    platformType: "CLOUD_API",
  };

  it("resolves by hint phone number id", () => {
    const result = resolveCoexistencePhoneNumber([coexistenceNumber, otherNumber], "phone-2");
    expect(result.id).toBe("phone-2");
  });

  it("resolves unique coexistence candidate", () => {
    const result = resolveCoexistencePhoneNumber([coexistenceNumber, otherNumber]);
    expect(result.id).toBe("phone-1");
  });

  it("throws when ambiguous", () => {
    expect(() =>
      resolveCoexistencePhoneNumber([
        { id: "a", isOnBizApp: true, platformType: "CLOUD_API" },
        { id: "b", isOnBizApp: true, platformType: "CLOUD_API" },
      ])
    ).toThrow(/unique phone number/);
  });
});
