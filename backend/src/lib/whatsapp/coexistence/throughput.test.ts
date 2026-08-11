import { getCoexistenceSendDelayMs } from "./throughput.js";

describe("coexistence throughput", () => {
  it("targets 20 messages per second", () => {
    expect(getCoexistenceSendDelayMs()).toBe(50);
  });
});
