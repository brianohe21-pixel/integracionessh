"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Smile } from "lucide-react";
import { EMOJI_CATEGORIES, type EmojiCategoryId } from "@/lib/emojis";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";

type Props = {
  onInsert: (emoji: string) => void;
};

type PickerPosition = {
  top: number;
  left: number;
};

type PickerPlacement = "above" | "below";

const PICKER_WIDTH = 384;
const GAP_PX = 10;
const ESTIMATED_HEIGHT = 360;

const CATEGORY_LABEL_KEYS: Record<EmojiCategoryId, `conversations.emojiCategory${Capitalize<EmojiCategoryId>}`> = {
  smileys: "conversations.emojiCategorySmileys",
  gestures: "conversations.emojiCategoryGestures",
  hearts: "conversations.emojiCategoryHearts",
  animals: "conversations.emojiCategoryAnimals",
  food: "conversations.emojiCategoryFood",
  travel: "conversations.emojiCategoryTravel",
  objects: "conversations.emojiCategoryObjects",
  symbols: "conversations.emojiCategorySymbols",
};

export function EmojiPicker({ onInsert }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<PickerPosition | null>(null);
  const [placement, setPlacement] = useState<PickerPlacement>("above");
  const [activeCategory, setActiveCategory] = useState<EmojiCategoryId>("smileys");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const popoverHeight = popoverRef.current?.offsetHeight ?? ESTIMATED_HEIGHT;
    const spaceAbove = rect.top - GAP_PX * 2;
    const spaceBelow = window.innerHeight - rect.bottom - GAP_PX * 2;
    const openAbove = spaceAbove >= popoverHeight || spaceAbove >= spaceBelow;
    const left = Math.min(
      Math.max(GAP_PX, rect.left),
      window.innerWidth - PICKER_WIDTH - GAP_PX
    );

    setPlacement(openAbove ? "above" : "below");

    if (openAbove) {
      const bottomEdge = rect.top - GAP_PX;
      const topEdge = bottomEdge - popoverHeight;
      setPosition({
        top: topEdge < GAP_PX ? GAP_PX + popoverHeight : bottomEdge,
        left,
      });
      return;
    }

    const topEdge = rect.bottom + GAP_PX;
    const bottomEdge = topEdge + popoverHeight;
    setPosition({
      top: bottomEdge > window.innerHeight - GAP_PX
        ? Math.max(GAP_PX, window.innerHeight - GAP_PX - popoverHeight)
        : topEdge,
      left,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    updatePosition();
    const frame = requestAnimationFrame(() => updatePosition());
    return () => cancelAnimationFrame(frame);
  }, [open, activeCategory, updatePosition]);

  useEffect(() => {
    if (!open) return;

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  function handleSelect(emoji: string) {
    onInsert(emoji);
    setOpen(false);
  }

  const activeEmojis =
    EMOJI_CATEGORIES.find((category) => category.id === activeCategory)?.emojis ?? [];

  const popover =
    open && mounted ? (
      <div
        ref={popoverRef}
        style={{
          top: position?.top ?? 0,
          left: position?.left ?? GAP_PX,
          width: PICKER_WIDTH,
          maxHeight: `min(22rem, calc(100vh - ${GAP_PX * 2}px))`,
          transform: placement === "above" ? "translateY(-100%)" : undefined,
          visibility: position ? "visible" : "hidden",
        }}
        className="fixed z-[300] flex flex-col overflow-hidden rounded-2xl border border-default bg-surface-elevated shadow-[0_12px_40px_rgba(0,0,0,0.18)]"
      >
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-default p-2.5">
          {EMOJI_CATEGORIES.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setActiveCategory(category.id)}
              title={t(CATEGORY_LABEL_KEYS[category.id])}
              className={cn(
                "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-2xl leading-none transition-colors",
                activeCategory === category.id
                  ? "bg-surface text-primary"
                  : "text-secondary hover:bg-surface hover:text-primary"
              )}
            >
              {category.emojis[0]}
            </button>
          ))}
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-8 gap-1 overflow-y-auto p-3">
          {activeEmojis.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleSelect(emoji)}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-2xl leading-none transition-colors hover:bg-surface"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "conversations-compose-action",
          open && "bg-surface-elevated text-primary"
        )}
        aria-label={t("conversations.emojiPickerLabel")}
        title={t("conversations.emojiPickerLabel")}
        aria-expanded={open}
      >
        <Smile className="h-4 w-4" />
      </button>
      {mounted && popover ? createPortal(popover, document.body) : null}
    </>
  );
}
