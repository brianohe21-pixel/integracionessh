import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  buildPublicCalendarUrl,
  generateCalendarPublicKey,
  resolvePublicCalendarContext,
} from "./public-link.js";
import { getBotByCalendarPublicKey } from "../dynamodb/bot-lookup.repository.js";
import { getCalendarConfig } from "../dynamodb/calendar-config.repository.js";
import { getBot } from "../dynamodb/bot.repository.js";
import { requireEnabledCalendar } from "./calendar.service.js";

jest.mock("../dynamodb/bot-lookup.repository.js");
jest.mock("../dynamodb/calendar-config.repository.js");
jest.mock("../dynamodb/bot.repository.js");
jest.mock("./calendar.service.js");

const mockedGetBotByCalendarPublicKey = jest.mocked(getBotByCalendarPublicKey);
const mockedGetCalendarConfig = jest.mocked(getCalendarConfig);
const mockedGetBot = jest.mocked(getBot);
const mockedRequireEnabledCalendar = jest.mocked(requireEnabledCalendar);

describe("generateCalendarPublicKey", () => {
  it("returns clk_ prefixed key", () => {
    const key = generateCalendarPublicKey();
    expect(key.startsWith("clk_")).toBe(true);
    expect(key.length).toBeGreaterThan(10);
  });
});

describe("buildPublicCalendarUrl", () => {
  it("builds book path from frontend url", () => {
    process.env.FRONTEND_URL = "https://app.example.com/";
    expect(buildPublicCalendarUrl("clk_test")).toBe("https://app.example.com/book/clk_test");
  });
});

describe("resolvePublicCalendarContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("throws 404 when lookup is missing", async () => {
    mockedGetBotByCalendarPublicKey.mockResolvedValue(null);
    await expect(resolvePublicCalendarContext("clk_missing")).rejects.toMatchObject({
      message: "Invalid calendar link",
      statusCode: 404,
    });
  });

  it("throws 404 when public link is disabled", async () => {
    mockedGetBotByCalendarPublicKey.mockResolvedValue({
      tenantId: "t1",
      botId: "b1",
    });
    mockedGetCalendarConfig.mockResolvedValue({
      tenantId: "t1",
      botId: "b1",
      enabled: true,
      publicLinkEnabled: false,
      calendarPublicKey: "clk_test",
      timezone: "America/Bogota",
      slotDurationMinutes: 30,
      bufferMinutes: 0,
      maxAdvanceDays: 7,
      minNoticeHours: 0,
      weeklySchedule: {
        monday: [],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: [],
        saturday: [],
        sunday: [],
      },
      provider: "native",
      createdAt: "",
      updatedAt: "",
    });

    await expect(resolvePublicCalendarContext("clk_test")).rejects.toMatchObject({
      message: "Public calendar link is not available",
      statusCode: 404,
    });
  });

  it("resolves when calendar and public link are enabled", async () => {
    mockedGetBotByCalendarPublicKey.mockResolvedValue({
      tenantId: "t1",
      botId: "b1",
    });
    const config = {
      tenantId: "t1",
      botId: "b1",
      enabled: true,
      publicLinkEnabled: true,
      calendarPublicKey: "clk_test",
      timezone: "America/Bogota",
      slotDurationMinutes: 30,
      bufferMinutes: 0,
      maxAdvanceDays: 7,
      minNoticeHours: 0,
      weeklySchedule: {
        monday: [],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: [],
        saturday: [],
        sunday: [],
      },
      provider: "native" as const,
      createdAt: "",
      updatedAt: "",
    };
    mockedGetCalendarConfig.mockResolvedValue(config);
    mockedRequireEnabledCalendar.mockResolvedValue(config);
    mockedGetBot.mockResolvedValue({
      botId: "b1",
      tenantId: "t1",
      name: "Test Bot",
      phoneNumberId: "p1",
      responseMode: "openai",
      createdAt: "",
      updatedAt: "",
    } as never);

    const ctx = await resolvePublicCalendarContext("clk_test");
    expect(ctx.botName).toBe("Test Bot");
    expect(ctx.tenantId).toBe("t1");
  });
});
