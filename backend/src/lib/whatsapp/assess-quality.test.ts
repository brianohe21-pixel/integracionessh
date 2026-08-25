import {
  assessWhatsAppPhone,
  pickWorstWhatsAppAssessment,
  scoreWhatsAppPhone,
} from "./assess-quality.js";

describe("assessWhatsAppPhone", () => {
  it("returns block for red quality", () => {
    const result = assessWhatsAppPhone({
      qualityRating: "RED",
      status: "CONNECTED",
    });
    expect(result.risk).toBe("block");
    expect(result.blockReason).toBe("red");
  });

  it("returns warn for yellow quality", () => {
    const result = assessWhatsAppPhone({
      qualityRating: "YELLOW",
      status: "CONNECTED",
    });
    expect(result.risk).toBe("warn");
    expect(result.warnReason).toBe("yellow");
  });

  it("returns ok for green quality", () => {
    const result = assessWhatsAppPhone({
      qualityRating: "GREEN",
      status: "CONNECTED",
    });
    expect(result.risk).toBe("ok");
    expect(scoreWhatsAppPhone({ qualityRating: "GREEN", status: "CONNECTED" })).toBe(100);
  });
});

describe("pickWorstWhatsAppAssessment", () => {
  it("prefers block over warn and ok", () => {
    const worst = pickWorstWhatsAppAssessment([
      assessWhatsAppPhone({ qualityRating: "GREEN", status: "CONNECTED" }),
      assessWhatsAppPhone({ qualityRating: "YELLOW", status: "CONNECTED" }),
      assessWhatsAppPhone({ qualityRating: "RED", status: "CONNECTED" }),
    ]);
    expect(worst?.risk).toBe("block");
  });
});
