import {
  createOpsAlert,
  tryClaimOpsAlertDedupe,
} from "../dynamodb/ops-alert.repository.js";
import { getTenant } from "../dynamodb/tenant.repository.js";
import { sendEmail } from "../email/client.js";
import { publishRealtimeEventSafe } from "../realtime/publish.js";
import { emitOpsAlert } from "./emit.js";
import { resolveOpsAlertsSettings } from "./settings.js";
import { planUsagePercentages, telephonySpendUsd } from "./thresholds.js";

jest.mock("../dynamodb/tenant.repository.js", () => ({
  getTenant: jest.fn(),
}));

jest.mock("../dynamodb/ops-alert.repository.js", () => ({
  tryClaimOpsAlertDedupe: jest.fn(),
  releaseOpsAlertDedupe: jest.fn(),
  createOpsAlert: jest.fn(),
}));

jest.mock("../email/client.js", () => ({
  sendEmail: jest.fn(),
}));

jest.mock("../realtime/publish.js", () => ({
  publishRealtimeEventSafe: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("resolveOpsAlertsSettings", () => {
  it("defaults all rules disabled", () => {
    const settings = resolveOpsAlertsSettings(null);
    expect(settings.rules).toHaveLength(7);
    expect(settings.rules.every((rule) => !rule.enabled)).toBe(true);
    expect(settings.rules.find((r) => r.id === "plan_usage")?.thresholdPercent).toBe(85);
    expect(settings.rules.find((r) => r.id === "telephony_spend")?.thresholdUsd).toBe(50);
  });
});

describe("emitOpsAlert", () => {
  it("skips when rule is disabled", async () => {
    jest.mocked(getTenant).mockResolvedValue({
      tenantId: "t1",
      name: "Acme",
      email: "a@b.c",
      plan: "pro",
      status: "active",
      createdAt: "",
      updatedAt: "",
      opsAlerts: {
        emailRecipients: ["ops@acme.com"],
        rules: [
          {
            id: "webhook_failed",
            enabled: false,
            inApp: true,
            email: true,
          },
        ],
      },
    } as never);

    const result = await emitOpsAlert({
      tenantId: "t1",
      ruleId: "webhook_failed",
      title: "Webhook failed",
      body: "Delivery failed",
      href: "/developer",
      dedupeKey: "webhook:d1",
    });

    expect(result).toBeNull();
    expect(tryClaimOpsAlertDedupe).not.toHaveBeenCalled();
  });

  it("skips when dedupe already claimed", async () => {
    jest.mocked(getTenant).mockResolvedValue({
      tenantId: "t1",
      name: "Acme",
      email: "a@b.c",
      plan: "pro",
      status: "active",
      createdAt: "",
      updatedAt: "",
      opsAlerts: {
        emailRecipients: ["ops@acme.com"],
        rules: [
          {
            id: "webhook_failed",
            enabled: true,
            inApp: true,
            email: true,
          },
        ],
      },
    } as never);
    jest.mocked(tryClaimOpsAlertDedupe).mockResolvedValue(false);

    const result = await emitOpsAlert({
      tenantId: "t1",
      ruleId: "webhook_failed",
      title: "Webhook failed",
      body: "Delivery failed",
      href: "/developer",
      dedupeKey: "webhook:d1",
    });

    expect(result).toBeNull();
    expect(createOpsAlert).not.toHaveBeenCalled();
  });

  it("persists and notifies when enabled", async () => {
    jest.mocked(getTenant).mockResolvedValue({
      tenantId: "t1",
      name: "Acme",
      email: "a@b.c",
      plan: "pro",
      status: "active",
      createdAt: "",
      updatedAt: "",
      opsAlerts: {
        emailRecipients: ["ops@acme.com"],
        rules: [
          {
            id: "webhook_failed",
            enabled: true,
            inApp: true,
            email: true,
          },
        ],
      },
    } as never);
    jest.mocked(tryClaimOpsAlertDedupe).mockResolvedValue(true);
    jest.mocked(createOpsAlert).mockResolvedValue({
      alertId: "a1",
      tenantId: "t1",
      ruleId: "webhook_failed",
      title: "Webhook failed",
      body: "Delivery failed",
      href: "/developer",
      severity: "warning",
      dedupeKey: "webhook:d1",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    jest.mocked(sendEmail).mockResolvedValue(undefined as never);

    const result = await emitOpsAlert({
      tenantId: "t1",
      ruleId: "webhook_failed",
      title: "Webhook failed",
      body: "Delivery failed",
      href: "/developer",
      dedupeKey: "webhook:d1",
    });

    expect(result?.alertId).toBe("a1");
    expect(publishRealtimeEventSafe).toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["ops@acme.com"],
        subject: "[Ops] Webhook failed",
      })
    );
  });
});

describe("thresholds", () => {
  it("computes plan usage percentages", () => {
    const pct = planUsagePercentages(
      {
        messagesCount: 850,
        campaignsStarted: 0,
        bulkRecipientsCount: 0,
        voicebotMinutesCount: 0,
      },
      {
        maxMessagesPerMonth: 1000,
        maxActiveCampaigns: 10,
        maxBulkRecipientsPerJob: 1000,
        maxVoicebotMinutesPerMonth: 100,
      }
    );
    expect(pct.messages).toBe(85);
  });

  it("sums telephony spend", () => {
    const total = telephonySpendUsd([
      { costBreakdown: { totalUsd: 12.5 } },
      { costBreakdown: { totalUsd: 7.25 } },
      {},
    ]);
    expect(total).toBe(19.75);
  });
});
