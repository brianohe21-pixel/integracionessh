import { describe, expect, it } from "@jest/globals";
import {
  isCampaignSendAttemptTerminal,
} from "./campaign-send-attempt.repository.js";

describe("isCampaignSendAttemptTerminal", () => {
  it("returns false only for queued", () => {
    expect(isCampaignSendAttemptTerminal("queued")).toBe(false);
    expect(isCampaignSendAttemptTerminal("sent")).toBe(true);
    expect(isCampaignSendAttemptTerminal("delivered")).toBe(true);
    expect(isCampaignSendAttemptTerminal("read")).toBe(true);
    expect(isCampaignSendAttemptTerminal("delivery_failed")).toBe(true);
    expect(isCampaignSendAttemptTerminal("send_failed")).toBe(true);
    expect(isCampaignSendAttemptTerminal("compliance_blocked")).toBe(true);
  });
});
