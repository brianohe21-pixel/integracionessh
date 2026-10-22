import { analyzeSmsMessages, getSmsSegmentInfo, renderSmsTemplateBody } from "./sms-segments";

describe("getSmsSegmentInfo", () => {
  it("detects the INT-78 over-limit message as 2 GSM-7 segments", () => {
    const text =
      "Tigo tiene un gran descuento para ti ponte al dia pagando menos por tu linea en mora 3042509759-10103 Ref 8963061509 info 3503189808 paga en https://bit.ly/tigo_pagos";
    expect(getSmsSegmentInfo(text)).toMatchObject({
      encoding: "gsm7",
      chars: 166,
      segments: 2,
    });
  });
});

describe("analyzeSmsMessages", () => {
  it("reports over-limit rows with encoding and segments", () => {
    const summary = analyzeSmsMessages([
      { to: "573000000001", text: "ok" },
      {
        to: "573014177052",
        text: "Tigo tiene un gran descuento para ti ponte al dia pagando menos por tu linea en mora 3042509759-10103 Ref 8963061509 info 3503189808 paga en https://bit.ly/tigo_pagos",
      },
    ]);
    expect(summary.overOneSegment).toBe(1);
    expect(summary.estimatedBillableSegments).toBe(3);
    expect(summary.overLimit[0]?.to).toBe("573014177052");
  });
});

describe("renderSmsTemplateBody", () => {
  it("substitutes numbered placeholders", () => {
    expect(renderSmsTemplateBody("Hola {{1}}, ref {{2}}", ["Ana", "99"])).toBe(
      "Hola Ana, ref 99"
    );
  });
});
