"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/i18n/context";
import type { PublicCalendarDate } from "@/lib/public-calendar-api";

interface PublicBookingCalendarProps {
  dates: PublicCalendarDate[];
  selectedIsoDate?: string | null;
  accent?: string;
  disabled?: boolean;
  waitlistIsoDates?: Set<string>;
  onSelectDate: (date: PublicCalendarDate) => void;
}

function parseIsoDate(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month: month - 1, day };
}

function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function monthIndex(year: number, month: number): number {
  return year * 12 + month;
}

function getWeekdayLabels(locale: "es" | "en", weekStartsOn: 0 | 1): string[] {
  const labels: string[] = [];
  const start = weekStartsOn === 1 ? new Date(Date.UTC(2024, 0, 1)) : new Date(Date.UTC(2024, 0, 7));
  const fmt = new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-US", { weekday: "short" });
  for (let i = 0; i < 7; i++) {
    labels.push(fmt.format(new Date(start.getTime() + i * 86_400_000)));
  }
  return labels;
}

function buildMonthCells(year: number, month: number, weekStartsOn: 0 | 1) {
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const offset = weekStartsOn === 1 ? (firstWeekday + 6) % 7 : firstWeekday;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const daysInPrevMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: Array<{ isoDate: string; day: number; inCurrentMonth: boolean }> = [];

  for (let i = offset - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    cells.push({ isoDate: toIsoDate(prevYear, prevMonth, day), day, inCurrentMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ isoDate: toIsoDate(year, month, day), day, inCurrentMonth: true });
  }

  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    cells.push({ isoDate: toIsoDate(nextYear, nextMonth, nextDay), day: nextDay, inCurrentMonth: false });
    nextDay++;
  }

  return cells;
}

export function PublicBookingCalendar({
  dates,
  selectedIsoDate,
  accent = "#25D366",
  disabled = false,
  waitlistIsoDates,
  onSelectDate,
}: PublicBookingCalendarProps) {
  const t = useT();
  const locale = useLocale();
  const weekStartsOn: 0 | 1 = locale === "es" ? 1 : 0;

  const dateMap = useMemo(() => new Map(dates.map((d) => [d.isoDate, d])), [dates]);
  const availableSet = useMemo(() => new Set(dates.map((d) => d.isoDate)), [dates]);
  const emptyWaitlistSet = useMemo(() => new Set<string>(), []);
  const waitlistSet = waitlistIsoDates ?? emptyWaitlistSet;

  const calendarDates = useMemo(() => {
    if (waitlistSet.size === 0) return dates;
    const merged = new Map(dates.map((d) => [d.isoDate, d]));
    for (const iso of waitlistSet) {
      if (!merged.has(iso)) {
        const label = new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-US", {
          weekday: "short",
          day: "numeric",
          month: "short",
        }).format(new Date(`${iso}T12:00:00`));
        merged.set(iso, { isoDate: iso, label });
      }
    }
    return Array.from(merged.values()).sort((a, b) => a.isoDate.localeCompare(b.isoDate));
  }, [dates, waitlistSet, locale]);

  const bounds = useMemo(() => {
    if (calendarDates.length === 0) {
      const now = new Date();
      const year = now.getUTCFullYear();
      const month = now.getUTCMonth();
      return { min: monthIndex(year, month), max: monthIndex(year, month) };
    }
    const first = parseIsoDate(calendarDates[0].isoDate);
    const last = parseIsoDate(calendarDates[calendarDates.length - 1].isoDate);
    return {
      min: monthIndex(first.year, first.month),
      max: monthIndex(last.year, last.month),
    };
  }, [calendarDates]);

  const initial = useMemo(() => {
    if (calendarDates.length === 0) {
      const now = new Date();
      return { year: now.getUTCFullYear(), month: now.getUTCMonth() };
    }
    return parseIsoDate(calendarDates[0].isoDate);
  }, [calendarDates]);

  const [viewYear, setViewYear] = useState(initial.year);
  const [viewMonth, setViewMonth] = useState(initial.month);

  useEffect(() => {
    setViewYear(initial.year);
    setViewMonth(initial.month);
  }, [initial.year, initial.month]);

  const currentIndex = monthIndex(viewYear, viewMonth);
  const canGoPrev = currentIndex > bounds.min;
  const canGoNext = currentIndex < bounds.max;

  const todayIso = useMemo(() => {
    const now = new Date();
    return toIsoDate(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const monthLabel = useMemo(() => {
    const label = new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-US", {
      month: "long",
      year: "numeric",
    }).format(new Date(Date.UTC(viewYear, viewMonth, 1)));
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [locale, viewYear, viewMonth]);

  const weekdayLabels = useMemo(() => getWeekdayLabels(locale, weekStartsOn), [locale, weekStartsOn]);
  const cells = useMemo(
    () => buildMonthCells(viewYear, viewMonth, weekStartsOn),
    [viewYear, viewMonth, weekStartsOn]
  );

  function goPrevMonth() {
    if (!canGoPrev) return;
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function goNextMonth() {
    if (!canGoNext) return;
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  return (
    <div className="rounded-xl border border-default bg-surface-elevated p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={goPrevMonth}
          disabled={!canGoPrev || disabled}
          aria-label={t("publicBook.prevMonth")}
          className="rounded-lg p-2 text-secondary hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h3 className="text-sm font-semibold text-primary">{monthLabel}</h3>
        <button
          type="button"
          onClick={goNextMonth}
          disabled={!canGoNext || disabled}
          aria-label={t("publicBook.nextMonth")}
          className="rounded-lg p-2 text-secondary hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekdayLabels.map((label) => (
          <div
            key={label}
            className="py-1 text-center text-xs font-medium uppercase tracking-wide text-muted"
          >
            {label}
          </div>
        ))}

        {cells.map((cell) => {
          const available = availableSet.has(cell.isoDate);
          const waitlistOnly = !available && waitlistSet.has(cell.isoDate);
          const selectable = available || waitlistOnly;
          const selected = selectedIsoDate === cell.isoDate;
          const isToday = cell.isoDate === todayIso;

          return (
            <button
              key={cell.isoDate}
              type="button"
              disabled={disabled || !selectable}
              onClick={() => {
                const date = dateMap.get(cell.isoDate) ?? {
                  isoDate: cell.isoDate,
                  label: cell.isoDate,
                };
                onSelectDate(date);
              }}
              className={cn(
                "relative flex aspect-square items-center justify-center rounded-lg text-sm transition-colors",
                !cell.inCurrentMonth && "text-gray-300",
                cell.inCurrentMonth && !selectable && "cursor-not-allowed text-gray-300",
                cell.inCurrentMonth && waitlistOnly && !selected && "font-medium text-amber-700 hover:bg-amber-50",
                cell.inCurrentMonth && available && !selected && "font-medium text-primary hover:bg-surface-muted",
                selected && "font-semibold text-white"
              )}
              style={
                selected
                  ? { backgroundColor: accent }
                  : available && cell.inCurrentMonth
                    ? { color: accent }
                    : undefined
              }
            >
              {cell.day}
              {isToday && cell.inCurrentMonth && !selected ? (
                <span
                  className="absolute bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full"
                  style={{ backgroundColor: accent }}
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
