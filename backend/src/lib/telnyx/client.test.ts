import { isTelnyxCallEndedError } from "./client.js";

describe("isTelnyxCallEndedError", () => {
  it("detects Telnyx 90018 payload", () => {
    const error = new Error(
      'Telnyx API error (422): [{"code":"90018","title":"Call has already ended","detail":"This call is no longer active and can\'t receive commands."}]'
    );
    expect(isTelnyxCallEndedError(error)).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(isTelnyxCallEndedError(new Error("Telnyx API error (400): bad request"))).toBe(false);
    expect(isTelnyxCallEndedError("not an error")).toBe(false);
  });
});
