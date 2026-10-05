import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { ApiKey, TenantIntegration } from "../../types/index.js";

jest.mock("../dynamodb/api-key.repository.js", () => ({
  listApiKeysByTenant: jest.fn(),
}));

jest.mock("../dynamodb/api-key-usage.repository.js", () => ({
  listApiKeyUsageInRange: jest.fn(),
}));

jest.mock("../dynamodb/integration.repository.js", () => ({
  getTenantIntegration: jest.fn(),
}));

import { listApiKeysByTenant } from "../dynamodb/api-key.repository.js";
import { listApiKeyUsageInRange } from "../dynamodb/api-key-usage.repository.js";
import { getTenantIntegration } from "../dynamodb/integration.repository.js";
import {
  apiUsageSkBounds,
  buildApiUsageReport,
  getApiUsageReport,
  parseApiUsageRange,
} from "./api-usage-report.js";

const mockedListKeys = jest.mocked(listApiKeysByTenant);
const mockedListUsage = jest.mocked(listApiKeyUsageInRange);
const mockedGetIntegration = jest.mocked(getTenantIntegration);

const keys = [
  { keyId: "key-1", name: "Production", prefix: "sk_live_a" },
  { keyId: "key-2", name: "Staging", prefix: "sk_test_b" },
] as ApiKey[];

function integration(enabled: boolean): TenantIntegration {
  return {
    integrationId: "default",
    tenantId: "tenant-1",
    webhookUrl: "https://hooks.example.com/events",
    webhookSecret: "super-secret",
    subscribedEvents: ["message.received", "lead.created"],
    enabled,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-02T00:00:00.000Z",
  };
}

describe("api usage report", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("includes a log id written at the end of the range and excludes the next day", () => {
    const { fromSk, toSk } = apiUsageSkBounds("2026-10-01", "2026-10-05");
    const endOfRange = "2026-10-05T23:59:59.999Z#log-9";
    const nextDay = "2026-10-06T00:00:00.000Z#log-1";
    const dayBefore = "2026-09-30T23:59:59.999Z#log-1";

    expect(endOfRange >= fromSk && endOfRange <= toSk).toBe(true);
    expect(nextDay <= toSk).toBe(false);
    expect(dayBefore >= fromSk).toBe(false);
  });

  it("rejects ranges longer than 90 days", () => {
    expect(parseApiUsageRange("2026-01-01", "2026-05-01").ok).toBe(false);
    expect(parseApiUsageRange("not-a-date", "2026-10-05").ok).toBe(false);
  });

  it("sums every api key and splits success from errors by endpoint", () => {
    const report = buildApiUsageReport({
      from: "2026-10-01",
      to: "2026-10-02",
      keys,
      logs: [
        {
          keyId: "key-1",
          endpoint: "/v1/messages",
          method: "POST",
          statusCode: 200,
          createdAt: "2026-10-01T10:00:00.000Z",
        },
        {
          keyId: "key-1",
          endpoint: "/v1/messages",
          method: "POST",
          statusCode: 500,
          createdAt: "2026-10-01T11:00:00.000Z",
        },
        {
          keyId: "key-2",
          endpoint: "/v1/contacts",
          method: "GET",
          statusCode: 200,
          createdAt: "2026-10-02T08:00:00.000Z",
        },
      ],
      integration: null,
    });

    expect(report.totals).toEqual({ requests: 3, success: 2, error: 1 });
    expect(report.byKey).toEqual([
      {
        keyId: "key-1",
        keyName: "Production",
        prefix: "sk_live_a",
        requests: 2,
        success: 1,
        error: 1,
      },
      {
        keyId: "key-2",
        keyName: "Staging",
        prefix: "sk_test_b",
        requests: 1,
        success: 1,
        error: 0,
      },
    ]);
    expect(report.byEndpoint).toEqual([
      {
        endpoint: "/v1/messages",
        method: "POST",
        requests: 2,
        success: 1,
        error: 1,
      },
      {
        endpoint: "/v1/contacts",
        method: "GET",
        requests: 1,
        success: 1,
        error: 0,
      },
    ]);
    expect(report.daily).toEqual([
      { date: "2026-10-01", requests: 2, success: 1, error: 1 },
      { date: "2026-10-02", requests: 1, success: 1, error: 0 },
    ]);
  });

  it("keeps unused api keys in the breakdown", () => {
    const report = buildApiUsageReport({
      from: "2026-10-01",
      to: "2026-10-01",
      keys,
      logs: [],
      integration: null,
    });

    expect(report.totals.requests).toBe(0);
    expect(report.byKey.map((row) => row.keyId).sort()).toEqual(["key-1", "key-2"]);
    expect(report.byEndpoint).toEqual([]);
  });

  it("marks a saved disabled webhook as inactive and omits the secret", () => {
    const saved = integration(false);
    const report = buildApiUsageReport({
      from: "2026-10-01",
      to: "2026-10-01",
      keys: [],
      logs: [],
      integration: saved,
    });

    expect(report.webhooks).toEqual([
      {
        integrationId: "default",
        status: "inactive",
        url: "https://hooks.example.com/events",
        events: ["message.received", "lead.created"],
      },
    ]);
    expect(JSON.stringify(report)).not.toContain("super-secret");
  });

  it("marks an enabled webhook as active", () => {
    const report = buildApiUsageReport({
      from: "2026-10-01",
      to: "2026-10-01",
      keys: [],
      logs: [],
      integration: integration(true),
    });

    expect(report.webhooks[0]?.status).toBe("active");
  });

  it("loads every tenant key and the saved webhook", async () => {
    mockedListKeys.mockResolvedValue(keys);
    mockedGetIntegration.mockResolvedValue(integration(false));
    mockedListUsage.mockImplementation(async (_tenantId, keyId) => {
      if (keyId === "key-1") {
        return [
          {
            keyId,
            endpoint: "/v1/messages",
            method: "POST",
            statusCode: 201,
            createdAt: "2026-10-03T12:00:00.000Z",
          },
        ];
      }
      return [
        {
          keyId,
          endpoint: "/v1/messages",
          method: "POST",
          statusCode: 401,
          createdAt: "2026-10-03T13:00:00.000Z",
        },
      ];
    });

    const report = await getApiUsageReport("tenant-1", "2026-10-03", "2026-10-03");

    expect(mockedListUsage).toHaveBeenCalledTimes(2);
    expect(mockedListUsage).toHaveBeenCalledWith(
      "tenant-1",
      "key-1",
      "2026-10-03T00:00:00.000Z",
      "2026-10-03T23:59:59.999Z#\uffff"
    );
    expect(report.totals).toEqual({ requests: 2, success: 1, error: 1 });
    expect(report.webhooks[0]?.status).toBe("inactive");
    expect(JSON.stringify(report)).not.toContain("super-secret");
  });
});
