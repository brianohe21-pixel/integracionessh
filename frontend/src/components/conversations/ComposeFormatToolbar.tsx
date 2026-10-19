"use client";

import {
  Bold,
  Code2,
  Italic,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
} from "lucide-react";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";
import type { WhatsAppTextFormat } from "@/lib/conversations/whatsapp-text-format";

type Props = {
  visible: boolean;
  onFormat: (format: WhatsAppTextFormat) => void;
  position: { top: number; left: number } | null;
  className?: string;
};

const ACTIONS: {
  format: WhatsAppTextFormat;
  icon: typeof Bold;
  labelKey: string;
}[] = [
  { format: "bold", icon: Bold, labelKey: "conversations.formatBold" },
  { format: "italic", icon: Italic, labelKey: "conversations.formatItalic" },
  {
    format: "strikethrough",
    icon: Strikethrough,
    labelKey: "conversations.formatStrikethrough",
  },
  { format: "monospace", icon: Code2, labelKey: "conversations.formatMonospace" },
  {
    format: "ordered",
    icon: ListOrdered,
    labelKey: "conversations.formatOrderedList",
  },
  {
    format: "unordered",
    icon: List,
    labelKey: "conversations.formatUnorderedList",
  },
  { format: "quote", icon: Quote, labelKey: "conversations.formatQuote" },
];

export function ComposeFormatToolbar({ visible, onFormat, position, className }: Props) {
  const t = useT();

  if (!visible || !position) return null;

  return (
    <div
      role="toolbar"
      aria-label={t("conversations.formatToolbar")}
      className={cn(
        "conversations-format-toolbar fixed z-50 flex items-center gap-0.5 rounded-full px-1.5 py-1",
        className
      )}
      style={{
        top: position.top,
        left: position.left,
        transform: "translateY(-100%)",
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {ACTIONS.map(({ format, icon: Icon, labelKey }) => (
        <button
          key={format}
          type="button"
          aria-label={t(labelKey)}
          title={t(labelKey)}
          className="conversations-format-toolbar__btn"
          onClick={() => onFormat(format)}
        >
          <Icon className="h-4 w-4" strokeWidth={2.25} />
        </button>
      ))}
    </div>
  );
}
