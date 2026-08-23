import {
  buildAvailablePhoneNumbersPath,
  buildTelnyxDetailRecordsPath,
  isTelnyxCallEndedError,
} from "./client.js";

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

  it("filters detail records by encoded call control id", () => {
    expect(buildTelnyxDetailRecordsPath("v3:abc/123")).toBe(
      "/detail_records?filter[record_type]=call-control&filter[call_control_id]=v3%3Aabc%2F123&page[size]=10"
    );
  });

  it("builds available phone number search path with voice feature", () => {
    expect(
      buildAvailablePhoneNumbersPath({
        countryCode: "US",
        phoneNumberType: "local",
        nationalDestinationCode: "305",
        limit: 10,
      })
    ).toBe(
      "/available_phone_numbers?filter%5Bcountry_code%5D=US&filter%5Bfeatures%5D%5B%5D=voice&filter%5Bphone_number_type%5D=local&filter%5Bnational_destination_code%5D=305&page%5Bsize%5D=10"
    );
  });
});
