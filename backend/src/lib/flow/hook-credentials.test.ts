import { hashFlowHookSecret, timingSafeEqual } from "./hook-credentials.js";

describe("flow hook credentials", () => {
  it("hashes secrets deterministically", () => {
    const hash = hashFlowHookSecret("fhs_test_secret");
    expect(hash).toHaveLength(64);
    expect(hashFlowHookSecret("fhs_test_secret")).toBe(hash);
  });

  it("compares secrets safely", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
  });
});
