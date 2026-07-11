import type { Locale } from "@/i18n/context";

const CALENDAR_TIMEZONES = [
  "America/Bogota",
  "America/Lima",
  "America/Guayaquil",
  "America/Caracas",
  "America/La_Paz",
  "America/Santiago",
  "America/Asuncion",
  "America/Montevideo",
  "America/Buenos_Aires",
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Fortaleza",
  "America/Recife",
  "America/Belem",
  "America/Cayenne",
  "America/Panama",
  "America/Costa_Rica",
  "America/Guatemala",
  "America/Tegucigalpa",
  "America/Managua",
  "America/El_Salvador",
  "America/Mexico_City",
  "America/Monterrey",
  "America/Cancun",
  "America/Tijuana",
  "America/Havana",
  "America/Santo_Domingo",
  "America/Puerto_Rico",
  "America/Jamaica",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "America/Toronto",
  "America/Vancouver",
  "America/Edmonton",
  "America/Halifax",
  "Europe/Madrid",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Rome",
  "Europe/Lisbon",
  "Atlantic/Canary",
  "Africa/Casablanca",
  "UTC",
] as const;

export interface TimezoneOption {
  value: string;
  label: string;
}

function formatTimezoneLabel(timezone: string, locale: Locale): string {
  if (timezone === "UTC") return "UTC";

  try {
    const now = new Date();
    const offset =
      new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-US", {
        timeZone: timezone,
        timeZoneName: "shortOffset",
      })
        .formatToParts(now)
        .find((part) => part.type === "timeZoneName")?.value ?? "";

    const city = timezone.split("/").pop()?.replace(/_/g, " ") ?? timezone;
    return offset ? `${city} (${offset})` : city;
  } catch {
    return timezone;
  }
}

export function getCalendarTimezoneOptions(
  locale: Locale,
  currentTimezone?: string
): TimezoneOption[] {
  const values = new Set<string>(CALENDAR_TIMEZONES);
  if (currentTimezone?.trim()) {
    values.add(currentTimezone.trim());
  }

  return Array.from(values)
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({
      value,
      label: formatTimezoneLabel(value, locale),
    }));
}
