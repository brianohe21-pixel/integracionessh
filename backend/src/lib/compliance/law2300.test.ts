import { getColombianHolidayDates } from "./colombian-holidays.js";
import { evaluateLaw2300At, getNextLaw2300WindowStart, LAW_2300_TIMEZONE } from "./law2300.js";

function bogotaDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0
): Date {
  const utc = new Date(Date.UTC(year, month - 1, day, hour + 5, minute, 0));
  return utc;
}

describe("getColombianHolidayDates", () => {
  it("includes fixed and movable holidays for 2025", () => {
    const holidays = getColombianHolidayDates(2025);
    expect(holidays.has("2025-01-01")).toBe(true);
    expect(holidays.has("2025-05-01")).toBe(true);
    expect(holidays.has("2025-07-20")).toBe(true);
    expect(holidays.has("2025-12-25")).toBe(true);
    expect(holidays.has("2025-04-17")).toBe(true);
    expect(holidays.has("2025-04-18")).toBe(true);
  });
});

describe("evaluateLaw2300At", () => {
  it("allows weekday business hours", () => {
    const wednesdayMorning = bogotaDate(2025, 3, 5, 10);
    const result = evaluateLaw2300At(wednesdayMorning);
    expect(result.enforced).toBe(true);
    expect(result.allowed).toBe(true);
  });

  it("blocks outside weekday hours", () => {
    const wednesdayNight = bogotaDate(2025, 3, 5, 20);
    const result = evaluateLaw2300At(wednesdayNight);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("outside_window");
    expect(result.nextWindowAt).toBeInstanceOf(Date);
  });

  it("blocks sundays", () => {
    const sundayMorning = bogotaDate(2025, 3, 9, 10);
    const result = evaluateLaw2300At(sundayMorning);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("sunday");
  });

  it("blocks holidays", () => {
    const laborDay = bogotaDate(2025, 5, 1, 10);
    const result = evaluateLaw2300At(laborDay);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("holiday");
  });

  it("allows saturday morning window", () => {
    const saturdayMorning = bogotaDate(2025, 3, 8, 10);
    const result = evaluateLaw2300At(saturdayMorning);
    expect(result.allowed).toBe(true);
  });

  it("blocks saturday afternoon", () => {
    const saturdayAfternoon = bogotaDate(2025, 3, 8, 16);
    const result = evaluateLaw2300At(saturdayAfternoon);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("outside_window");
  });

  it("skips enforcement for exempt tenants", () => {
    const sundayMorning = bogotaDate(2025, 3, 9, 10);
    const result = evaluateLaw2300At(sundayMorning, { law2300Exempt: true });
    expect(result.enforced).toBe(false);
    expect(result.allowed).toBe(true);
  });
});

describe("getNextLaw2300WindowStart", () => {
  it("returns a future allowed window", () => {
    const wednesdayNight = bogotaDate(2025, 3, 5, 20);
    const next = getNextLaw2300WindowStart(wednesdayNight);
    expect(next.getTime()).toBeGreaterThan(wednesdayNight.getTime());
    expect(evaluateLaw2300At(next).allowed).toBe(true);
  });

  it("uses Bogota timezone", () => {
    expect(LAW_2300_TIMEZONE).toBe("America/Bogota");
  });
});
