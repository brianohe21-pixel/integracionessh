import { shouldRetryDelivery, retryDelayMs } from "./deliver.js";

describe("deliver retry policy", () => {
  it("allows retry below max attempts", () => {
    expect(shouldRetryDelivery(1)).toBe(true);
    expect(shouldRetryDelivery(2)).toBe(true);
  });

  it("stops retry at max attempts", () => {
    expect(shouldRetryDelivery(3)).toBe(false);
  });

  it("increases delay with attempt", () => {
    expect(retryDelayMs(0)).toBeLessThan(retryDelayMs(2));
  });
});
