"use client";

import { useEffect, useRef, useState, type ChangeEvent, type ComponentType } from "react";
import { createPortal } from "react-dom";
import { Calendar, FileText, Loader2, MessageSquarePlus, Paperclip, Plus } from "lucide-react";
import { MacroPicker } from "@/components/conversations/MacroPicker";
import { useMacros } from "@/hooks/useMacros";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";
import type { MacroPlaceholderContext } from "@/lib/macros/resolve-placeholders";
import type { Conversation } from "@/types";

type Props = {
  conversation: Conversation;
  draft: string;
  macroPlaceholderContext: MacroPlaceholderContext;
  onDraftChange: (value: string) => void;
  onOpenQuotation: () => void;
  onOpenBooking?: () => void;
  showBooking?: boolean;
  showAttachment?: boolean;
  onAttachFile?: (file: File) => void;
  attaching?: boolean;
};

type MenuItem = {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  onClick: () => void;
};

type MenuPosition = {
  top: number;
  left: number;
  width: number;
};

const MENU_WIDTH = 224;
const GAP_PX = 8;

export function ConversationComposeActionsMenu({
  conversation,
  draft,
  macroPlaceholderContext,
  onDraftChange,
  onOpenQuotation,
  onOpenBooking,
  showBooking = false,
  showAttachment = false,
  onAttachFile,
  attaching = false,
}: Props) {
  const t = useT();
  const { data: macros } = useMacros(conversation.botId);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [macroOpen, setMacroOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);

  const hasMacros = (macros?.length ?? 0) > 0;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      setMenuPosition(null);
      return;
    }

    function updatePosition() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const left = Math.min(
        Math.max(GAP_PX, rect.left),
        window.innerWidth - MENU_WIDTH - GAP_PX
      );
      setMenuPosition({
        top: rect.top - GAP_PX,
        left,
        width: MENU_WIDTH,
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setMenuOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const items: MenuItem[] = [];

  if (hasMacros) {
    items.push({
      id: "macros",
      label: t("macros.pickerLabel"),
      icon: MessageSquarePlus,
      onClick: () => {
        setMenuOpen(false);
        setMacroOpen(true);
      },
    });
  }

  if (showAttachment && onAttachFile) {
    items.push({
      id: "attachment",
      label: t("conversations.attachFile"),
      icon: Paperclip,
      onClick: () => {
        setMenuOpen(false);
        fileInputRef.current?.click();
      },
    });
  }

  items.push({
    id: "quotation",
    label: t("quotations.drawerTitle"),
    icon: FileText,
    onClick: () => {
      setMenuOpen(false);
      onOpenQuotation();
    },
  });

  if (showBooking && onOpenBooking) {
    items.push({
      id: "booking",
      label: t("conversations.bookMeetingTitle"),
      icon: Calendar,
      onClick: () => {
        setMenuOpen(false);
        onOpenBooking();
      },
    });
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !onAttachFile) return;
    onAttachFile(file);
  }

  const menu =
    menuOpen && menuPosition && mounted ? (
      <div
        ref={menuRef}
        role="menu"
        aria-label={t("conversations.composeActionsMenu")}
        style={{
          top: menuPosition.top,
          left: menuPosition.left,
          width: menuPosition.width,
          transform: "translateY(-100%)",
        }}
        className="fixed z-[200] overflow-hidden rounded-xl border border-default bg-surface-elevated p-1 shadow-[0_12px_40px_rgba(0,0,0,0.18)]"
      >
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              onClick={item.onClick}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-primary transition-colors hover:bg-surface-muted"
            >
              <Icon className="h-4 w-4 shrink-0 text-secondary" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={t("conversations.composeActionsMenu")}
        title={t("conversations.composeActionsMenu")}
        disabled={attaching}
        className={cn(
          "conversations-compose-action",
          (menuOpen || attaching) && "bg-surface-elevated text-primary"
        )}
      >
        {attaching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
      </button>

      {mounted && menu ? createPortal(menu, document.body) : null}

      {hasMacros ? (
        <MacroPicker
          botId={conversation.botId}
          placeholderContext={macroPlaceholderContext}
          draft={draft}
          onInsert={onDraftChange}
          hideTrigger
          anchorRef={triggerRef}
          open={macroOpen}
          onOpenChange={setMacroOpen}
        />
      ) : null}
    </>
  );
}
