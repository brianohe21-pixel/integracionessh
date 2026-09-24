"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

const TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, index) => {
  const hours = Math.floor(index / 4);
  const minutes = (index % 4) * 15;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
});

export function formatTimeAmPm(time: string): string {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return time;
  const hours24 = Number(match[1]);
  const minutes = match[2];
  const period = hours24 >= 12 ? "pm" : "am";
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${minutes}${period}`;
}

export function parseTimeInput(raw: string): string | null {
  const value = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (!value) return null;

  const ampmMatch = /^(\d{1,2})(?::(\d{2}))?(am|pm)$/.exec(value);
  if (ampmMatch) {
    let hours = Number(ampmMatch[1]);
    const minutes = Number(ampmMatch[2] ?? "0");
    const period = ampmMatch[3];
    if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null;
    if (period === "am") {
      hours = hours === 12 ? 0 : hours;
    } else {
      hours = hours === 12 ? 12 : hours + 12;
    }
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  const twentyFourMatch = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (twentyFourMatch) {
    const hours = Number(twentyFourMatch[1]);
    const minutes = Number(twentyFourMatch[2]);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  const hourOnlyMatch = /^(\d{1,2})$/.exec(value);
  if (hourOnlyMatch) {
    const hours = Number(hourOnlyMatch[1]);
    if (hours < 0 || hours > 23) return null;
    return `${String(hours).padStart(2, "0")}:00`;
  }

  return null;
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  "aria-label"?: string;
  className?: string;
};

export function TaskTimePicker({
  value,
  onChange,
  disabled,
  "aria-label": ariaLabel,
  className,
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(formatTimeAmPm(value || "09:00"));
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(0, TIME_OPTIONS.indexOf(value || "09:00"))
  );

  useEffect(() => {
    if (!open) {
      setDraft(formatTimeAmPm(value || "09:00"));
    }
  }, [value, open]);

  useEffect(() => {
    if (!open) return;
    const selected =
      listRef.current?.querySelector<HTMLElement>('[data-active="true"]') ??
      listRef.current?.querySelector<HTMLElement>('[data-selected="true"]');
    selected?.scrollIntoView({ block: "nearest" });
  }, [open, value, activeIndex]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const options = useMemo(() => TIME_OPTIONS, []);

  function commitDraft(nextDraft = draft) {
    const parsed = parseTimeInput(nextDraft);
    if (parsed) {
      onChange(parsed);
      setDraft(formatTimeAmPm(parsed));
      setActiveIndex(Math.max(0, TIME_OPTIONS.indexOf(parsed)));
      return parsed;
    }
    setDraft(formatTimeAmPm(value || "09:00"));
    return value || "09:00";
  }

  function selectOption(time: string) {
    onChange(time);
    setDraft(formatTimeAmPm(time));
    setActiveIndex(Math.max(0, TIME_OPTIONS.indexOf(time)));
    setOpen(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((prev) => Math.min(options.length - 1, prev + 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((prev) => Math.max(0, prev - 1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (open && options[activeIndex]) {
        selectOption(options[activeIndex]);
      } else {
        commitDraft();
        setOpen(false);
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setDraft(formatTimeAmPm(value || "09:00"));
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Input
        type="text"
        inputMode="text"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        disabled={disabled}
        value={disabled ? "" : draft}
        onFocus={() => {
          if (disabled) return;
          setOpen(true);
          setActiveIndex(Math.max(0, TIME_OPTIONS.indexOf(value || "09:00")));
        }}
        onChange={(event) => {
          setDraft(event.target.value);
          setOpen(true);
          const parsed = parseTimeInput(event.target.value);
          if (!parsed) return;
          const index = TIME_OPTIONS.indexOf(parsed);
          if (index >= 0) setActiveIndex(index);
        }}
        onBlur={() => {
          commitDraft();
        }}
        onKeyDown={handleKeyDown}
        placeholder="9:00am"
      />
      {open && !disabled ? (
        <ul
          id={listId}
          ref={listRef}
          role="listbox"
          className="absolute z-50 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-default bg-surface-elevated py-1 shadow-lg"
        >
          {options.map((time, index) => {
            const selected = time === value;
            const active = index === activeIndex;
            return (
              <li key={time} role="option" aria-selected={selected}>
                <button
                  type="button"
                  data-selected={selected ? "true" : "false"}
                  data-active={active ? "true" : "false"}
                  className={cn(
                    "flex w-full px-3 py-1.5 text-left text-sm text-primary",
                    (selected || active) && "bg-surface-muted"
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectOption(time)}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  {formatTimeAmPm(time)}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
