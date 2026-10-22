import {
  analyzeSmsMessages,
  getSmsSegmentInfo,
  resolveSmsFreeTextMessages,
} from "./segments.js";

describe("getSmsSegmentInfo", () => {
  it("counts a single GSM-7 segment up to 160 chars", () => {
    const text = "a".repeat(160);
    expect(getSmsSegmentInfo(text)).toMatchObject({
      encoding: "gsm7",
      chars: 160,
      segments: 1,
      maxSingle: 160,
      maxConcat: 153,
    });
  });

  it("uses concat size 153 when GSM-7 exceeds 160", () => {
    const text = "a".repeat(161);
    expect(getSmsSegmentInfo(text)).toMatchObject({
      encoding: "gsm7",
      chars: 161,
      segments: 2,
    });
  });

  it("counts GSM extended characters as two units", () => {
    const text = `${"a".repeat(159)}€`;
    expect(getSmsSegmentInfo(text)).toMatchObject({
      encoding: "gsm7",
      chars: 161,
      segments: 2,
    });
  });

  it("switches to UCS-2 for non-GSM characters like acute accents", () => {
    expect(getSmsSegmentInfo("día")).toMatchObject({
      encoding: "ucs2",
      chars: 3,
      segments: 1,
      maxSingle: 70,
      maxConcat: 67,
    });
  });

  it("keeps ñ in GSM-7", () => {
    expect(getSmsSegmentInfo("niño")).toMatchObject({
      encoding: "gsm7",
      chars: 4,
      segments: 1,
    });
  });

  it("detects the INT-78 over-limit Tigo message as 2 GSM-7 segments", () => {
    const text =
      "Tigo tiene un gran descuento para ti ponte al dia pagando menos por tu linea en mora 3042509759-10103 Ref 8963061509 info 3503189808 paga en https://bit.ly/tigo_pagos";
    expect(text.length).toBe(166);
    expect(getSmsSegmentInfo(text)).toMatchObject({
      encoding: "gsm7",
      chars: 166,
      segments: 2,
    });
  });

  it("returns zero segments for empty text", () => {
    expect(getSmsSegmentInfo("")).toMatchObject({ chars: 0, segments: 0 });
  });
});

describe("analyzeSmsMessages", () => {
  it("summarizes over-limit rows and billable segments", () => {
    const single = "ok";
    const multi =
      "Tigo tiene un gran descuento para ti ponte al dia pagando menos por tu linea en mora 3042509759-10103 Ref 8963061509 info 3503189808 paga en https://bit.ly/tigo_pagos";
    const summary = analyzeSmsMessages([
      { to: "573000000001", text: single },
      { to: "573014177052", text: multi },
    ]);

    expect(summary.total).toBe(2);
    expect(summary.overOneSegment).toBe(1);
    expect(summary.estimatedBillableSegments).toBe(3);
    expect(summary.byEncoding.gsm7).toBe(2);
    expect(summary.samples).toHaveLength(1);
    expect(summary.samples[0]?.to).toBe("573014177052");
    expect(summary.samples[0]?.segments).toBe(2);
  });
});

describe("resolveSmsFreeTextMessages", () => {
  it("prefers per-recipient text and falls back to shared text", () => {
    expect(
      resolveSmsFreeTextMessages("shared", [
        { to: "1", text: "custom" },
        { to: "2" },
        { to: "3", text: "   " },
      ])
    ).toEqual([
      { to: "1", text: "custom" },
      { to: "2", text: "shared" },
      { to: "3", text: "shared" },
    ]);
  });
});
