import {
  calculateUsdPriceInCopCents,
  copToAmountCents,
  resetTrmCacheForTests,
  roundCopToNearestThousand,
  usdToCopWithTrm,
} from "./trm.js";

describe("trm", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    resetTrmCacheForTests();
    delete process.env.BILLING_TRM_FALLBACK_COP;
  });

  it("rounds COP to the nearest thousand", () => {
    expect(roundCopToNearestThousand(328_456)).toBe(328_000);
    expect(roundCopToNearestThousand(328_500)).toBe(329_000);
  });

  it("converts USD to COP cents with TRM", () => {
    expect(usdToCopWithTrm(80, 4100)).toBe(328_000);
    expect(copToAmountCents(328_000)).toBe(32_800_000);
  });

  it("uses dataset value when fetch succeeds", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ valor: "4050.12" }],
    }) as typeof fetch;

    const result = await calculateUsdPriceInCopCents(80);
    expect(result.trm).toBe(4050.12);
    expect(result.amountInCents).toBe(32_400_000);
  });

  it("falls back to cached TRM when fetch fails", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ valor: "4000" }],
    }) as typeof fetch;

    await calculateUsdPriceInCopCents(80);

    global.fetch = jest.fn().mockRejectedValue(new Error("offline")) as typeof fetch;

    const result = await calculateUsdPriceInCopCents(80);
    expect(result.trm).toBe(4000);
    expect(result.amountInCents).toBe(32_000_000);
  });
});
