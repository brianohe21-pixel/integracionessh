import { describe, expect, it } from "@jest/globals";
import { buildCampaignExportS3Key } from "./client.js";

describe("buildCampaignExportS3Key", () => {
  it("builds a tenant-scoped export key with sanitized filename", () => {
    const key = buildCampaignExportS3Key(
      "tenant-1",
      "camp-123",
      "campaign-whatsapp-promo verano-2026-10-22.csv"
    );
    expect(key).toMatch(
      /^tenants\/tenant-1\/campaign-exports\/camp-123\/\d+-campaign-whatsapp-promo_verano-2026-10-22\.csv$/
    );
  });
});
