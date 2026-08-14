import { mixUlawBytes, ulawDecode, ulawEncode } from "./ulaw-mixer.js";

describe("ulaw mixer", () => {
  it("round-trips ulaw samples within quantization error", () => {
    const sample = ulawEncode(1000);
    const decoded = ulawDecode(sample);
    expect(decoded).toBeGreaterThan(900);
    expect(decoded).toBeLessThan(1100);
  });

  it("mixes background into primary audio", () => {
    const primary = ulawEncode(5000);
    const background = ulawEncode(2000);
    const mixed = mixUlawBytes(primary, background, 0.5);
    expect(mixed).not.toBe(primary);
    expect(ulawDecode(mixed)).toBeGreaterThan(ulawDecode(primary));
  });
});
