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
  HtmlButton,
  Separator,
  Toolbar,
} from "react-simple-wysiwyg";
import { EmojiPicker } from "@/components/conversations/EmojiPicker";
import { HtmlEditorLinkProvider, HtmlEditorLinkToolbarButton } from "@/components/mailrelay/HtmlEditorLinks";
import { insertIntoContentEditable } from "@/lib/text-insert";
import { cn } from "@/lib/utils";

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
    const [mounted, setMounted] = useState(false);
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
      if (!mounted) return;
      const toolbar = containerRef.current?.querySelector(".rsw-toolbar");
      if (!toolbar) return;

      toolbar.addEventListener("mouseup", syncEditorValue);
      return () => toolbar.removeEventListener("mouseup", syncEditorValue);
    }, [mounted, syncEditorValue]);

    function insertAtCursor(text: string) {
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
      <div ref={containerRef} className={cn("mailrelay-html-editor", className)}>
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
              <Separator />
              <HtmlButton />
            </Toolbar>
          </HtmlEditorLinkProvider>
        </Editor>
      </div>
    );
  }
);
