"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import Editor, {
  BtnBold,
  BtnBulletList,
  BtnClearFormatting,
  BtnItalic,
  BtnNumberedList,
  BtnRedo,
  BtnStrikeThrough,
  BtnStyles,
  BtnUnderline,
  BtnUndo,
  Separator,
  Toolbar,
} from "react-simple-wysiwyg";
import { Code2, Type } from "lucide-react";
import { EmojiPicker } from "@/components/conversations/EmojiPicker";
import { HtmlEditorLinkProvider, HtmlEditorLinkToolbarButton } from "@/components/mailrelay/HtmlEditorLinks";
import { insertIntoContentEditable } from "@/lib/text-insert";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/context";

export type MailrelayHtmlEditorHandle = {
  insertAtCursor: (text: string) => void;
};

interface MailrelayHtmlEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const MailrelayHtmlEditor = forwardRef<MailrelayHtmlEditorHandle, MailrelayHtmlEditorProps>(
  function MailrelayHtmlEditor({ value, onChange, placeholder, className }, ref) {
    const t = useT();
    const [mounted, setMounted] = useState(false);
    const [mode, setMode] = useState<"visual" | "html">("visual");
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      setMounted(true);
    }, []);

    const syncEditorValue = useCallback(() => {
      const editable = containerRef.current?.querySelector("[contenteditable]") as HTMLElement | null;
      if (!editable) return;
      const html = editable.innerHTML;
      if (html !== value) {
        onChange(html);
      }
    }, [onChange, value]);

    useEffect(() => {
      if (!mounted || mode !== "visual") return;
      const toolbar = containerRef.current?.querySelector(".rsw-toolbar");
      if (!toolbar) return;

      toolbar.addEventListener("mouseup", syncEditorValue);
      return () => toolbar.removeEventListener("mouseup", syncEditorValue);
    }, [mounted, mode, syncEditorValue]);

    function insertAtCursor(text: string) {
      if (mode === "html") {
        onChange(value.trim() ? `${value}${text}` : text);
        return;
      }
      const editable = containerRef.current?.querySelector("[contenteditable]") as HTMLElement | null;
      if (!editable) {
        onChange(value.trim() ? `${value} ${text}` : text);
        return;
      }
      if (insertIntoContentEditable(editable, text)) {
        onChange(editable.innerHTML);
      } else {
        onChange(value.trim() ? `${value} ${text}` : text);
      }
    }

    useImperativeHandle(ref, () => ({
      insertAtCursor,
    }));

    if (!mounted) {
      return (
        <div
          className={cn(
            "mailrelay-html-editor min-h-64 rounded-lg border border-default bg-surface-elevated",
            className
          )}
        />
      );
    }

    return (
      <div className={cn("mailrelay-html-editor space-y-2", className)}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-lg border border-default bg-surface-muted p-0.5">
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                mode === "visual"
                  ? "bg-surface-elevated text-primary shadow-sm"
                  : "text-secondary hover:text-primary"
              )}
              onClick={() => setMode("visual")}
            >
              <Type className="h-3.5 w-3.5" />
              {t("mailrelay.editor.visual")}
            </button>
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                mode === "html"
                  ? "bg-surface-elevated text-primary shadow-sm"
                  : "text-secondary hover:text-primary"
              )}
              onClick={() => setMode("html")}
            >
              <Code2 className="h-3.5 w-3.5" />
              {t("mailrelay.editor.html")}
            </button>
          </div>
          <p className="text-xs text-muted">
            {mode === "html" ? t("mailrelay.editor.htmlHint") : t("mailrelay.editor.visualHint")}
          </p>
        </div>

        {mode === "html" ? (
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder ?? t("mailrelay.editor.htmlPlaceholder")}
            spellCheck={false}
            className="min-h-64 w-full resize-y rounded-lg border border-default bg-surface-elevated px-3 py-2.5 font-mono text-sm text-primary outline-none focus:ring-2 focus:ring-accent"
          />
        ) : (
          <div ref={containerRef}>
            <Editor
              value={value}
              placeholder={placeholder}
              onChange={(event) => onChange(event.target.value)}
              onBlur={syncEditorValue}
              containerProps={{ className: "mailrelay-html-editor__container" }}
            >
              <HtmlEditorLinkProvider onApplied={syncEditorValue}>
                <Toolbar>
                  <BtnUndo />
                  <BtnRedo />
                  <Separator />
                  <BtnStyles />
                  <Separator />
                  <BtnBold />
                  <BtnItalic />
                  <BtnUnderline />
                  <BtnStrikeThrough />
                  <Separator />
                  <BtnNumberedList />
                  <BtnBulletList />
                  <Separator />
                  <HtmlEditorLinkToolbarButton />
                  <BtnClearFormatting />
                  <Separator />
                  <EmojiPicker onInsert={insertAtCursor} triggerClassName="rsw-btn" />
                </Toolbar>
              </HtmlEditorLinkProvider>
            </Editor>
          </div>
        )}
      </div>
    );
  }
);
