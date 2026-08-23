import { mulawBase64ToSeconds } from "./deepgram.js";

describe("deepgram stt adapter helpers", () => {
  it("converts mulaw payload size to audio seconds", () => {
    const payload = Buffer.alloc(8000).toString("base64");
    expect(mulawBase64ToSeconds(payload)).toBe(1);
  });
});
