import { isInboundTelnyxMedia } from "./bridge.js";

describe("telephony bridge", () => {
  it("accepts inbound media and legacy frames without track", () => {
    expect(isInboundTelnyxMedia("inbound")).toBe(true);
    expect(isInboundTelnyxMedia(undefined)).toBe(true);
  });

  it("ignores outbound media echoes", () => {
    expect(isInboundTelnyxMedia("outbound")).toBe(false);
  });
});
