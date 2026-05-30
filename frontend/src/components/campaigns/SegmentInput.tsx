"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/context";

interface SegmentInputProps {
  value: string[];
  onChange: (segments: string[]) => void;
  placeholder?: string;
  max?: number;
  className?: string;
}

export function SegmentInput({
  value,
  onChange,
  placeholder,
  max = 20,
  className,
}: SegmentInputProps) {
  const t = useT();
  const [input, setInput] = useState("");

  function addSegment(raw: string) {
    const tag = raw.trim().slice(0, 50);
    if (!tag || value.includes(tag) || value.length >= max) return;
    onChange([...value, tag]);
    setInput("");
  }

  function removeSegment(tag: string) {
    onChange(value.filter((s) => s !== tag));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addSegment(input);
    } else if (e.key === "Backspace" && !input && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div
      className={cn(
        "flex flex-wrap gap-1.5 p-2 border border-gray-300 rounded-lg bg-white min-h-[42px] focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500",
        className
      )}
    >
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-sm font-medium"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeSegment(tag)}
            className="hover:text-indigo-900 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      {value.length < max && (
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => addSegment(input)}
          placeholder={value.length === 0 ? (placeholder ?? t("campaigns.segmentsPlaceholder")) : undefined}
          className="flex-1 min-w-[120px] outline-none text-sm text-gray-700 placeholder:text-gray-400 bg-transparent"
        />
      )}
    </div>
  );
}
