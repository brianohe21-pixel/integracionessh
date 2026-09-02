"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import Editor, {
  BtnBold,
  BtnBulletList,
  BtnClearFormatting,
  BtnItalic,
  BtnLink,
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

    useImperativeHandle(ref, () => ({
      insertAtCursor(text: string) {
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
      },
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
          containerProps={{ className: "mailrelay-html-editor__container" }}
        >
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
            <BtnLink />
            <BtnClearFormatting />
            <Separator />
            <HtmlButton />
          </Toolbar>
        </Editor>
      </div>
    );
  }
);
