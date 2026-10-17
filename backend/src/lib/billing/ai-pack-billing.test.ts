import {
  buildAiUsageSnapshot,
  findAiMessagePack,
  getAiBonusMessagesGranted,
  listActiveAiMessagePacks,
  normalizeAiMessagePacks,
} from "./ai-pack-billing.js";

describe("ai-pack-billing", () => {
  it("normalizes packs and falls back to defaults", () => {
    expect(normalizeAiMessagePacks(undefined).length).toBeGreaterThan(0);
    expect(
      normalizeAiMessagePacks([
        { id: "custom", messages: 100, priceCents: 1_000_000, active: true },
        { id: "bad", messages: 0, priceCents: 100 },
      ])
    ).toEqual([{ id: "custom", messages: 100, priceCents: 1_000_000, active: true }]);
  });

  it("lists only active packs", () => {
    const packs = listActiveAiMessagePacks({
      aiMessagePacks: [
        { id: "a", messages: 100, priceCents: 1000, active: true },
        { id: "b", messages: 200, priceCents: 2000, active: false },
      ],
    });
    expect(packs.map((p) => p.id)).toEqual(["a"]);
    expect(findAiMessagePack({ aiMessagePacks: packs }, "a")?.messages).toBe(100);
    expect(findAiMessagePack({ aiMessagePacks: packs }, "b")).toBeNull();
  });

  it("ignores bonus from a different period", () => {
    expect(
      getAiBonusMessagesGranted(
        { aiBonusMessagesPeriod: "2026-09", aiBonusMessagesGranted: 500 },
        "2026-10"
      )
    ).toBe(0);
    expect(
      getAiBonusMessagesGranted(
        { aiBonusMessagesPeriod: "2026-10", aiBonusMessagesGranted: 500 },
        "2026-10"
      )
    ).toBe(500);
  });

  it("consumes plan quota before purchased packs", () => {
    const snapshot = buildAiUsageSnapshot(
      { aiBonusMessagesPeriod: "2026-10", aiBonusMessagesGranted: 300 },
      1000,
      1150,
      "2026-10"
    );
    expect(snapshot.planUsed).toBe(1000);
    expect(snapshot.bonusUsed).toBe(150);
    expect(snapshot.bonusRemaining).toBe(150);
    expect(snapshot.effectiveLimit).toBe(1300);
    expect(snapshot.totalUsed).toBe(1150);
  });

  it("keeps bonus unused while plan quota remains", () => {
    const snapshot = buildAiUsageSnapshot(
      { aiBonusMessagesPeriod: "2026-10", aiBonusMessagesGranted: 300 },
      1000,
      200,
      "2026-10"
    );
    expect(snapshot.planUsed).toBe(200);
    expect(snapshot.bonusUsed).toBe(0);
    expect(snapshot.bonusRemaining).toBe(300);
  });
});
