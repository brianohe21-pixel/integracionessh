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
  sendTemplateApprovedEmail: jest.fn(),
  sendTemplateRejectedEmail: jest.fn(),
  sendTemplateStatusChangedEmail: jest.fn(),
}));

import { getBotByWabaId } from "../dynamodb/bot-lookup.repository.js";
import { getCachedTemplate, upsertCachedTemplate } from "../dynamodb/template.repository.js";
import { getTenant } from "../dynamodb/tenant.repository.js";
import {
  sendTemplateApprovedEmail,
  sendTemplateRejectedEmail,
  sendTemplateStatusChangedEmail,
} from "../email/template-status-notify.js";
import {
  mapTemplateStatusEvent,
  processMessageTemplateStatusUpdate,
} from "./template-status-update.js";

const mockedGetBotByWabaId = getBotByWabaId as jest.MockedFunction<typeof getBotByWabaId>;
const mockedGetCachedTemplate = getCachedTemplate as jest.MockedFunction<typeof getCachedTemplate>;
const mockedUpsertCachedTemplate = upsertCachedTemplate as jest.MockedFunction<
  typeof upsertCachedTemplate
>;
const mockedGetTenant = getTenant as jest.MockedFunction<typeof getTenant>;
const mockedSendApproved = sendTemplateApprovedEmail as jest.MockedFunction<
  typeof sendTemplateApprovedEmail
>;
const mockedSendRejected = sendTemplateRejectedEmail as jest.MockedFunction<
  typeof sendTemplateRejectedEmail
>;
const mockedSendChanged = sendTemplateStatusChangedEmail as jest.MockedFunction<
  typeof sendTemplateStatusChangedEmail
>;

describe("mapTemplateStatusEvent", () => {
  it("maps Meta lifecycle events to local statuses", () => {
    expect(mapTemplateStatusEvent("APPROVED")).toBe("APPROVED");
    expect(mapTemplateStatusEvent("REINSTATED")).toBe("APPROVED");
    expect(mapTemplateStatusEvent("REJECTED")).toBe("REJECTED");
    expect(mapTemplateStatusEvent("PENDING")).toBe("PENDING");
    expect(mapTemplateStatusEvent("PAUSED")).toBe("PENDING");
    expect(mapTemplateStatusEvent("UNKNOWN")).toBeNull();
  });
});

describe("processMessageTemplateStatusUpdate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetBotByWabaId.mockResolvedValue({ tenantId: "tenant-1", botId: "bot-1" });
    mockedGetTenant.mockResolvedValue({
      tenantId: "tenant-1",
      name: "Acme",
      email: "owner@acme.com",
    } as never);
  });

  it("updates cache and emails when Meta approves a template", async () => {
    mockedGetCachedTemplate.mockResolvedValue({
      templateId: "tpl-1",
      tenantId: "tenant-1",
      botId: "bot-1",
      name: "order_confirmation",
      language: "es",
      category: "UTILITY",
      status: "PENDING",
      components: [],
      syncedAt: "2026-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    await processMessageTemplateStatusUpdate("waba-1", {
      event: "APPROVED",
      message_template_id: 123,
      message_template_name: "order_confirmation",
      message_template_language: "es",
      message_template_category: "UTILITY",
      reason: "NONE",
    });

    expect(mockedUpsertCachedTemplate).toHaveBeenCalledWith(
      "tenant-1",
      "bot-1",
      expect.objectContaining({
        name: "order_confirmation",
        language: "es",
        status: "APPROVED",
        metaTemplateId: "123",
      })
    );
    expect(mockedSendApproved).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "owner@acme.com",
        templateName: "order_confirmation",
      })
    );
    expect(mockedSendRejected).not.toHaveBeenCalled();
  });

  it("emails rejection details when Meta rejects a template", async () => {
    mockedGetCachedTemplate.mockResolvedValue({
      templateId: "tpl-1",
      tenantId: "tenant-1",
      botId: "bot-1",
      name: "promo",
      language: "es",
      category: "MARKETING",
      status: "PENDING",
      components: [],
      syncedAt: "2026-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    await processMessageTemplateStatusUpdate("waba-1", {
      event: "REJECTED",
      message_template_id: 456,
      message_template_name: "promo",
      message_template_language: "es",
      message_template_category: "MARKETING",
      reason: "INVALID_FORMAT",
      rejection_info: {
        reason: "Variables are not clearly separated.",
        recommendation: "Add descriptive text between variables.",
      },
    });

    expect(mockedSendRejected).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "owner@acme.com",
        templateName: "promo",
        reason: expect.stringContaining("INVALID_FORMAT"),
      })
    );
  });

  it("skips email when status did not change", async () => {
    mockedGetCachedTemplate.mockResolvedValue({
      templateId: "tpl-1",
      tenantId: "tenant-1",
      botId: "bot-1",
      name: "order_confirmation",
      language: "es",
      category: "UTILITY",
      status: "APPROVED",
      components: [],
      syncedAt: "2026-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    await processMessageTemplateStatusUpdate("waba-1", {
      event: "APPROVED",
      message_template_id: 123,
      message_template_name: "order_confirmation",
      message_template_language: "es",
    });

    expect(mockedUpsertCachedTemplate).toHaveBeenCalled();
    expect(mockedSendApproved).not.toHaveBeenCalled();
    expect(mockedSendChanged).not.toHaveBeenCalled();
  });
});
