"use client";

import type { TimeRange, Weekday, WeeklySchedule } from "@/types";
import { useT } from "@/i18n/context";

const WEEKDAYS: Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

interface CalendarWeeklyScheduleProps {
  schedule: WeeklySchedule;
  onChange: (schedule: WeeklySchedule) => void;
}

export function CalendarWeeklySchedule({ schedule, onChange }: CalendarWeeklyScheduleProps) {
  const t = useT();

  function updateDay(day: Weekday, ranges: TimeRange[]) {
    onChange({ ...schedule, [day]: ranges });
  }

  function addRange(day: Weekday) {
    updateDay(day, [...schedule[day], { start: "09:00", end: "17:00" }]);
  }

  function removeRange(day: Weekday, index: number) {
    updateDay(
      day,
      schedule[day].filter((_, i) => i !== index)
    );
  }

  function patchRange(day: Weekday, index: number, patch: Partial<TimeRange>) {
    updateDay(
      day,
      schedule[day].map((r, i) => (i === index ? { ...r, ...patch } : r))
    );
  }

  return (
    <div className="space-y-4">
      {WEEKDAYS.map((day) => (
        <div key={day} className="rounded-lg border border-default p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="font-medium text-primary">{t(`calendar.days.${day}`)}</h4>
            <button
              type="button"
              onClick={() => addRange(day)}
              className="text-sm text-accent hover:text-accent"
            >
              {t("calendar.addRange")}
            </button>
          </div>
          {schedule[day].length === 0 ? (
            <p className="text-sm text-muted">{t("calendar.noRanges")}</p>
          ) : (
            <div className="space-y-2">
              {schedule[day].map((range, index) => (
                <div key={`${day}-${index}`} className="flex flex-wrap items-center gap-2">
                  <input
                    type="time"
                    value={range.start}
                    onChange={(e) => patchRange(day, index, { start: e.target.value })}
                    className="rounded border border-default px-2 py-1 text-sm"
                  />
                  <span className="text-muted">—</span>
                  <input
                    type="time"
                    value={range.end}
                    onChange={(e) => patchRange(day, index, { end: e.target.value })}
                    className="rounded border border-default px-2 py-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeRange(day, index)}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    {t("common.delete")}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
