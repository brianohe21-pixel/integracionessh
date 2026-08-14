import {
  isTelnyxHumanResult,
  isTelnyxMachineResult,
  isTelnyxSilenceResult,
  isTelnyxUncertainResult,
  shouldConnectOutboundAfterAmd,
  shouldHangupOutboundAfterAmd,
} from "./amd.js";

describe("Telnyx AMD helpers", () => {
  it("detects machine results", () => {
    expect(isTelnyxMachineResult("machine")).toBe(true);
    expect(isTelnyxMachineResult("fax_detected")).toBe(true);
    expect(isTelnyxMachineResult("silence")).toBe(true);
    expect(isTelnyxMachineResult("human")).toBe(false);
    expect(isTelnyxMachineResult("human_residence")).toBe(false);
  });

  it("detects human results", () => {
    expect(isTelnyxHumanResult("human")).toBe(true);
    expect(isTelnyxHumanResult("human_residence")).toBe(true);
    expect(isTelnyxHumanResult("human_business")).toBe(true);
    expect(isTelnyxHumanResult("machine")).toBe(false);
  });

  it("connects on human or uncertain results", () => {
    expect(isTelnyxUncertainResult("not_sure")).toBe(true);
    expect(shouldConnectOutboundAfterAmd("human_residence")).toBe(true);
    expect(shouldConnectOutboundAfterAmd("not_sure")).toBe(true);
    expect(shouldConnectOutboundAfterAmd("machine")).toBe(false);
  });

  it("hangs up on machine or beep even if already connected", () => {
    expect(shouldHangupOutboundAfterAmd("machine", true)).toBe(true);
    expect(shouldHangupOutboundAfterAmd("fax_detected", true)).toBe(true);
    expect(shouldHangupOutboundAfterAmd("beep_detected", true)).toBe(true);
    expect(shouldHangupOutboundAfterAmd("human", true)).toBe(false);
    expect(shouldHangupOutboundAfterAmd("not_sure", false)).toBe(false);
  });

  it("ignores silence after the agent is already connected", () => {
    expect(isTelnyxSilenceResult("silence")).toBe(true);
    expect(shouldHangupOutboundAfterAmd("silence", false)).toBe(true);
    expect(shouldHangupOutboundAfterAmd("silence", true)).toBe(false);
  });
});
