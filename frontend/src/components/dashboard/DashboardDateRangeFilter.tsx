"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { useLocale, useT } from "@/i18n/context";
import { cn } from "@/lib/utils";
import {
  currentMonthRange,
  dateRangeFromDays,
  formatDateUtc,
  isCurrentMonthRange,
  isPresetRange,
  normalizeDateRange,
  type MetricsDateRange,
} from "@/lib/metrics-date-range";

interface DashboardDateRangeFilterProps {
  value: MetricsDateRange;
  onChange: (range: MetricsDateRange) => void;
}

function previousMonthRange(now = new Date()): MetricsDateRange {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  return { from: formatDateUtc(from), to: formatDateUtc(to) };
}

function isPreviousMonthRange(range: MetricsDateRange, now = new Date()): boolean {
  const preset = previousMonthRange(now);
  return range.from === preset.from && range.to === preset.to;
}

export function DashboardDateRangeFilter({ value, onChange }: DashboardDateRangeFilterProps) {
  const t = useT();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const intlLocale = locale === "en" ? "en-US" : "es-ES";
  const formatShort = (dateStr: string) =>
    new Intl.DateTimeFormat(intlLocale, { day: "2-digit", month: "short" }).format(
      new Date(`${dateStr}T12:00:00.000Z`)
    );
  const yearOf = (dateStr: string) => new Date(`${dateStr}T12:00:00.000Z`).getUTCFullYear();

  const label = `${formatShort(value.from)} – ${formatShort(value.to)} ${yearOf(value.to)}`;

  const presets = [
    {
      key: "7d",
      label: t("dashboard.rangeLast7"),
      active: isPresetRange(value, 7),
      onSelect: () => onChange(dateRangeFromDays(7)),
    },
    {
      key: "14d",
      label: t("dashboard.rangeLast14"),
      active: isPresetRange(value, 14),
      onSelect: () => onChange(dateRangeFromDays(14)),
    },
    {
      key: "30d",
      label: t("dashboard.rangeLast30"),
      active: isPresetRange(value, 30),
      onSelect: () => onChange(dateRangeFromDays(30)),
    },
    {
      key: "thisMonth",
      label: t("dashboard.rangeThisMonth"),
      active: isCurrentMonthRange(value),
      onSelect: () => onChange(currentMonthRange()),
    },
    {
      key: "lastMonth",
      label: t("dashboard.rangeLastMonth"),
      active: isPreviousMonthRange(value),
      onSelect: () => onChange(previousMonthRange()),
    },
  ];

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-xl border border-default bg-surface-elevated px-3.5 py-2.5 text-sm font-medium text-primary shadow-sm transition-colors hover:bg-surface-muted"
      >
        <CalendarDays className="h-4 w-4 text-accent" />
        <span className="capitalize">{label}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-64 rounded-xl border border-default bg-surface-elevated p-3 shadow-lg">
          <div className="flex flex-col gap-1">
            {presets.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => {
                  preset.onSelect();
                  setOpen(false);
                }}
                className={cn(
                  "rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                  preset.active
                    ? "bg-accent-muted text-accent"
                    : "text-secondary hover:bg-surface-muted hover:text-primary"
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="mt-3 border-t border-subtle pt-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-secondary">
              {t("dashboard.rangeCustom")}
            </p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={value.from}
                max={value.to}
                onChange={(e) => onChange(normalizeDateRange(e.target.value, value.to))}
                className="w-full rounded-lg border border-default bg-surface px-2 py-1.5 text-xs text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <span className="text-xs text-muted">–</span>
              <input
                type="date"
                value={value.to}
                min={value.from}
                onChange={(e) => onChange(normalizeDateRange(value.from, e.target.value))}
                className="w-full rounded-lg border border-default bg-surface px-2 py-1.5 text-xs text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
