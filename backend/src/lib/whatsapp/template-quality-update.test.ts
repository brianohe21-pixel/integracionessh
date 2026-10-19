jest.mock("../dynamodb/bot-lookup.repository.js", () => ({
  getBotByWabaId: jest.fn(),
}));
jest.mock("../dynamodb/template.repository.js", () => ({
  getCachedTemplate: jest.fn(),
  upsertCachedTemplate: jest.fn(),
}));
jest.mock("../dynamodb/tenant.repository.js", () => ({
  getTenant: jest.fn(),
}));
jest.mock("../email/template-status-notify.js", () => ({
  sendTemplateQualityChangedEmail: jest.fn(),
}));

import { getBotByWabaId } from "../dynamodb/bot-lookup.repository.js";
import { getCachedTemplate, upsertCachedTemplate } from "../dynamodb/template.repository.js";
import { getTenant } from "../dynamodb/tenant.repository.js";
import { sendTemplateQualityChangedEmail } from "../email/template-status-notify.js";
import {
  mapTemplateQualityScore,
  processMessageTemplateQualityUpdate,
} from "./template-quality-update.js";

const mockedGetBotByWabaId = getBotByWabaId as jest.MockedFunction<typeof getBotByWabaId>;
const mockedGetCachedTemplate = getCachedTemplate as jest.MockedFunction<typeof getCachedTemplate>;
const mockedUpsertCachedTemplate = upsertCachedTemplate as jest.MockedFunction<
  typeof upsertCachedTemplate
>;
const mockedGetTenant = getTenant as jest.MockedFunction<typeof getTenant>;
const mockedSendQuality = sendTemplateQualityChangedEmail as jest.MockedFunction<
  typeof sendTemplateQualityChangedEmail
>;

describe("mapTemplateQualityScore", () => {
  it("maps Meta quality scores", () => {
    expect(mapTemplateQualityScore("GREEN")).toBe("GREEN");
    expect(mapTemplateQualityScore("yellow")).toBe("YELLOW");
    expect(mapTemplateQualityScore({ score: "RED" })).toBe("RED");
    expect(mapTemplateQualityScore("UNKNOWN")).toBe("UNKNOWN");
    expect(mapTemplateQualityScore("OTHER")).toBeNull();
  });
});

describe("processMessageTemplateQualityUpdate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetBotByWabaId.mockResolvedValue({ tenantId: "tenant-1", botId: "bot-1" });
    mockedGetTenant.mockResolvedValue({
      tenantId: "tenant-1",
      name: "Acme",
      email: "owner@acme.com",
    } as never);
  });

  it("updates cache and emails when Meta changes template quality", async () => {
    mockedGetCachedTemplate.mockResolvedValue({
      templateId: "tpl-1",
      tenantId: "tenant-1",
      botId: "bot-1",
      name: "welcome_template",
      language: "en_US",
      category: "MARKETING",
      status: "APPROVED",
      components: [],
      qualityScore: "GREEN",
      metaTemplateId: "806312974732579",
      syncedAt: "2026-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    await processMessageTemplateQualityUpdate("waba-1", {
      previous_quality_score: "GREEN",
      new_quality_score: "YELLOW",
      message_template_id: 806312974732579,
      message_template_name: "welcome_template",
      message_template_language: "en_US",
    });

    expect(mockedUpsertCachedTemplate).toHaveBeenCalledWith(
      "tenant-1",
      "bot-1",
      expect.objectContaining({
        name: "welcome_template",
        language: "en_US",
        qualityScore: "YELLOW",
        metaTemplateId: "806312974732579",
        status: "APPROVED",
      })
    );
    expect(mockedSendQuality).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "owner@acme.com",
        templateName: "welcome_template",
        previousScore: "GREEN",
        newScore: "YELLOW",
      })
    );
  });

  it("skips email when quality did not change", async () => {
    mockedGetCachedTemplate.mockResolvedValue({
      templateId: "tpl-1",
      tenantId: "tenant-1",
      botId: "bot-1",
      name: "welcome_template",
      language: "en_US",
      category: "UTILITY",
      status: "APPROVED",
      components: [],
      qualityScore: "GREEN",
      syncedAt: "2026-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    await processMessageTemplateQualityUpdate("waba-1", {
      previous_quality_score: "GREEN",
      new_quality_score: "GREEN",
      message_template_name: "welcome_template",
      message_template_language: "en_US",
    });

    expect(mockedUpsertCachedTemplate).toHaveBeenCalled();
    expect(mockedSendQuality).not.toHaveBeenCalled();
  });

  it("ignores incomplete payloads", async () => {
    await processMessageTemplateQualityUpdate("waba-1", {
      new_quality_score: "RED",
    });

    expect(mockedGetBotByWabaId).not.toHaveBeenCalled();
    expect(mockedUpsertCachedTemplate).not.toHaveBeenCalled();
  });
});
