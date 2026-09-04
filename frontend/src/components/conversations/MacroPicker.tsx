"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { MessageSquarePlus, Search } from "lucide-react";
import { useMacros } from "@/hooks/useMacros";
import { useT } from "@/i18n/context";
import { resolvePlaceholders, type MacroPlaceholderContext } from "@/lib/macros/resolve-placeholders";
import { cn } from "@/lib/utils";
import type { Macro } from "@/types";

type Props = {
  botId: string;
  placeholderContext: MacroPlaceholderContext;
  draft: string;
  onInsert: (text: string) => void;
  onShortcutQuery?: (query: string | null) => void;
  hideTrigger?: boolean;
  anchorRef?: RefObject<HTMLElement | null>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type PickerPosition = {
  top: number;
  left: number;
};

const PICKER_WIDTH = 288;
const GAP_PX = 8;

export function MacroPicker({
  botId,
  placeholderContext,
  draft,
  onInsert,
  onShortcutQuery,
  hideTrigger = false,
  anchorRef,
  open: controlledOpen,
  onOpenChange,
}: Props) {
  const t = useT();
  const { data: macros } = useMacros(botId);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [search, setSearch] = useState("");
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<PickerPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const usePortal = hideTrigger && Boolean(anchorRef);

  const shortcutMatch = draft.match(/(?:^|\s)\/([a-zA-Z0-9-]*)$/);
  const shortcutQuery = shortcutMatch?.[1] ?? null;

  const filtered = (macros ?? []).filter((macro) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      macro.title.toLowerCase().includes(q) ||
      macro.shortcut?.toLowerCase().includes(q) ||
      macro.content.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    onShortcutQuery?.(shortcutQuery);
  }, [shortcutQuery, onShortcutQuery]);

  useEffect(() => {
    if (!shortcutQuery && shortcutMatch) return;
    if (shortcutQuery !== null && macros?.length) {
      setOpen(true);
      setSearch(shortcutQuery);
    }
  }, [shortcutQuery, macros?.length, shortcutMatch, setOpen]);

  const updatePosition = useCallback(() => {
    const anchor = usePortal ? anchorRef?.current : containerRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const popoverHeight = popoverRef.current?.offsetHeight ?? 320;
    const left = Math.min(
      Math.max(GAP_PX, rect.left),
      window.innerWidth - PICKER_WIDTH - GAP_PX
    );
    const top = Math.max(GAP_PX, rect.top - GAP_PX - popoverHeight);
    setPosition({ top, left });
  }, [anchorRef, usePortal]);

  useLayoutEffect(() => {
    if (!open || !usePortal) {
      setPosition(null);
      return;
    }
    updatePosition();
    const frame = requestAnimationFrame(() => updatePosition());
    return () => cancelAnimationFrame(frame);
  }, [open, usePortal, updatePosition, search, filtered.length]);

  useEffect(() => {
    if (!open || !usePortal) return;
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, usePortal, updatePosition]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      if (anchorRef?.current?.contains(target)) return;
      setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open, anchorRef, setOpen]);

  function applyMacro(macro: Macro) {
    const resolved = resolvePlaceholders(macro.content, placeholderContext);
    const shortcutPrefix = shortcutMatch?.[0] ?? "";
    const base = shortcutPrefix ? draft.slice(0, draft.length - shortcutPrefix.length) : draft;

    if (base.trim()) {
      onInsert(`${base.trimEnd()}\n${resolved}`);
    } else {
      onInsert(resolved);
    }

    setOpen(false);
    setSearch("");
  }

  if (!macros?.length) return null;

  const panel = open ? (
    <div
      ref={popoverRef}
      style={
        usePortal
          ? {
              top: position?.top ?? 0,
              left: position?.left ?? GAP_PX,
              width: PICKER_WIDTH,
              visibility: position ? "visible" : "hidden",
            }
          : undefined
      }
      className={cn(
        "w-72 rounded-xl border border-default bg-surface-elevated shadow-[0_12px_40px_rgba(0,0,0,0.18)]",
        usePortal ? "fixed z-[200]" : "absolute bottom-full left-0 z-50 mb-2"
      )}
    >
      <div className="border-b border-default p-2">
        <div className="flex items-center gap-2 rounded-lg border border-default bg-surface px-2">
          <Search className="h-3.5 w-3.5 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("macros.pickerSearch")}
            className="w-full bg-transparent py-1.5 text-sm text-primary outline-none placeholder:text-muted"
          />
        </div>
      </div>
      <ul className="max-h-56 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <li className="px-3 py-2 text-sm text-muted">{t("macros.pickerEmpty")}</li>
        ) : (
          filtered.map((macro) => (
            <li key={macro.macroId}>
              <button
                type="button"
                onClick={() => applyMacro(macro)}
                className="w-full px-3 py-2 text-left hover:bg-surface"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-primary">{macro.title}</span>
                  {macro.shortcut && (
                    <span className="text-xs text-muted">/{macro.shortcut}</span>
                  )}
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-secondary">
                  {resolvePlaceholders(macro.content, placeholderContext)}
                </p>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  ) : null;

  return (
    <div ref={containerRef} className={cn(!hideTrigger && "relative")}>
      {!hideTrigger ? (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={cn(
            "conversations-compose-action",
            open && "bg-surface-elevated text-primary"
          )}
          aria-label={t("macros.pickerLabel")}
          title={t("macros.pickerLabel")}
        >
          <MessageSquarePlus className="h-4 w-4" />
        </button>
      ) : null}

      {usePortal && mounted && panel ? createPortal(panel, document.body) : panel}
    </div>
  );
}
