import { describe, expect, it } from "@jest/globals";
import {
  canArchiveCampaign,
  canCloneCampaign,
  canEditCampaign,
  canRetryFailedRecipients,
  resolvePreStartCampaignStatus,
} from "./management.js";

describe("resolvePreStartCampaignStatus", () => {
  it("returns scheduled when a future date is provided", () => {
    expect(resolvePreStartCampaignStatus("2026-12-01T10:00:00.000Z")).toBe("scheduled");
  });

  it("returns draft when schedule is cleared", () => {
    expect(resolvePreStartCampaignStatus(null)).toBe("draft");
    expect(resolvePreStartCampaignStatus(undefined)).toBe("draft");
  });
});

describe("canEditCampaign", () => {
  it("allows draft and scheduled campaigns", () => {
    expect(canEditCampaign("draft")).toBe(true);
    expect(canEditCampaign("scheduled")).toBe(true);
    expect(canEditCampaign("running")).toBe(false);
  });
});

describe("canArchiveCampaign", () => {
  it("blocks running campaigns", () => {
    expect(canArchiveCampaign("running")).toBe(false);
    expect(canArchiveCampaign("completed")).toBe(true);
  });
});

describe("canRetryFailedRecipients", () => {
  it("requires failed recipients and a retryable status", () => {
    expect(
      canRetryFailedRecipients({ status: "completed", failed: 2 })
    ).toBe(true);
    expect(
      canRetryFailedRecipients({ status: "completed", failed: 0 })
    ).toBe(false);
    expect(
      canRetryFailedRecipients({ status: "running", failed: 2 })
    ).toBe(false);
  });
});

describe("canCloneCampaign", () => {
  it("blocks active execution states", () => {
    expect(canCloneCampaign("completed")).toBe(true);
    expect(canCloneCampaign("running")).toBe(false);
    expect(canCloneCampaign("paused")).toBe(false);
  });
});
