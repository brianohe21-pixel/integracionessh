"use client";

import { useEffect, useRef, useState } from "react";
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
};

export function MacroPicker({ botId, placeholderContext, draft, onInsert, onShortcutQuery }: Props) {
  const t = useT();
  const { data: macros } = useMacros(botId);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const shortcutMatch = draft.match(/(?:^|\s)\/([a-zA-Z0-9-]*)$/);
  const shortcutQuery = shortcutMatch?.[1] ?? null;

  useEffect(() => {
    onShortcutQuery?.(shortcutQuery);
  }, [shortcutQuery, onShortcutQuery]);

  useEffect(() => {
    if (!shortcutQuery && shortcutMatch) return;
    if (shortcutQuery !== null && macros?.length) {
      setOpen(true);
      setSearch(shortcutQuery);
    }
  }, [shortcutQuery, macros?.length, shortcutMatch]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const filtered = (macros ?? []).filter((macro) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      macro.title.toLowerCase().includes(q) ||
      macro.shortcut?.toLowerCase().includes(q) ||
      macro.content.toLowerCase().includes(q)
    );
  });

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

  return (
    <div ref={containerRef} className="relative self-end">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full border border-default text-secondary transition-colors hover:bg-surface hover:text-primary",
          open && "bg-surface text-primary"
        )}
        aria-label={t("macros.pickerLabel")}
        title={t("macros.pickerLabel")}
      >
        <MessageSquarePlus className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-72 rounded-xl border border-default bg-surface-elevated shadow-xl">
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
      )}
    </div>
  );
}
