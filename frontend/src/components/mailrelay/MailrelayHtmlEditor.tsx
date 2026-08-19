"use client";

import { useEffect, useState } from "react";
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
import { cn } from "@/lib/utils";

interface MailrelayHtmlEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function MailrelayHtmlEditor({
  value,
  onChange,
  placeholder,
  className,
}: MailrelayHtmlEditorProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
    <div className={cn("mailrelay-html-editor", className)}>
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
