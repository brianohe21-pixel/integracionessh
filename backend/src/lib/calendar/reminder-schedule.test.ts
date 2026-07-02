import { describe, expect, it } from "@jest/globals";
import {
  bookingReminderScheduleName,
  computeReminderAt,
  renderReminderMessage,
  DEFAULT_REMINDER_MESSAGE,
} from "./reminder-schedule.js";

describe("computeReminderAt", () => {
  it("subtracts minutes from startAt", () => {
    const startAt = "2026-07-10T15:00:00.000Z";
    const reminderAt = computeReminderAt(startAt, 60);
    expect(reminderAt.toISOString()).toBe("2026-07-10T14:00:00.000Z");
  });
});

describe("renderReminderMessage", () => {
  it("replaces placeholders", () => {
    const text = renderReminderMessage(DEFAULT_REMINDER_MESSAGE, {
      name: "Ana",
      date: "10 jul",
      time: "10:00",
    });
    expect(text).toContain("Ana");
    expect(text).toContain("10 jul");
    expect(text).toContain("10:00");
  });
});

describe("bookingReminderScheduleName", () => {
  it("uses booking id prefix", () => {
    expect(bookingReminderScheduleName("abc-123")).toBe("booking-reminder-abc-123");
  });
});
