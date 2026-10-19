"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Textarea } from "@/components/ui/Input";
import { ComposeFormatToolbar } from "@/components/conversations/ComposeFormatToolbar";
import { EmojiPicker } from "@/components/conversations/EmojiPicker";
import { ConversationComposeActionsMenu } from "@/components/conversations/ConversationComposeActionsMenu";
import { ConversationVoiceRecorder } from "@/components/conversations/ConversationVoiceRecorder";
import { VoiceNoteComposeBar } from "@/components/conversations/VoiceNoteComposeBar";
import { useVoiceNoteRecorder } from "@/hooks/useVoiceNoteRecorder";
import { useT } from "@/i18n/context";
import {
  applyWhatsAppTextFormat,
  type WhatsAppTextFormat,
} from "@/lib/conversations/whatsapp-text-format";
import { getTextareaSelectionRect } from "@/lib/conversations/textarea-selection-rect";
import { cn } from "@/lib/utils";
import type { MacroPlaceholderContext } from "@/lib/macros/resolve-placeholders";
import type { Conversation } from "@/types";

const MAX_TEXTAREA_HEIGHT = 160;
const TOOLBAR_GAP_PX = 8;
const TOOLBAR_EDGE_PADDING_PX = 12;

type Props = {
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  sending: boolean;
  conversation: Conversation | null;
  macroPlaceholderContext: MacroPlaceholderContext;
  onOpenQuotation: () => void;
  onOpenBooking?: () => void;
  onOpenTask?: () => void;
  showBooking?: boolean;
  showAttachment?: boolean;
  onAttachFile?: (file: File) => void;
  onSendVoiceNote?: (file: File) => void | Promise<void>;
  onMicDenied?: () => void;
  onInvalidVoiceNote?: () => void;
  attaching?: boolean;
};

export function ConversationComposeBar({
  draft,
  onDraftChange,
  onSubmit,
  sending,
  conversation,
  macroPlaceholderContext,
  onOpenQuotation,
  onOpenBooking,
  onOpenTask,
  showBooking = false,
  showAttachment = false,
  onAttachFile,
  onSendVoiceNote,
  onMicDenied,
  onInvalidVoiceNote,
  attaching = false,
}: Props) {
  const t = useT();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [scrollable, setScrollable] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const selectionRef = useRef({ start: 0, end: 0 });

  const voice = useVoiceNoteRecorder({
    disabled: attaching || sending,
    sending: attaching || sending,
    onSendVoiceNote: onSendVoiceNote ?? (async () => {}),
    onMicDenied,
    onInvalidRecording: onInvalidVoiceNote,
  });

  const canSendText = Boolean(draft.trim()) && !sending && !voice.active;
  const canSendVoice = Boolean(voice.previewBlob) && !sending && !attaching;
  const canSend = canSendText || canSendVoice;

  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const nextHeight = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT);
    el.style.height = `${nextHeight}px`;
    setScrollable(el.scrollHeight > MAX_TEXTAREA_HEIGHT);
  }, []);

  const clearFormatToolbar = useCallback(() => {
    setHasSelection(false);
    setToolbarPosition(null);
    selectionRef.current = { start: 0, end: 0 };
  }, []);

  const updateToolbarPosition = useCallback((start: number, end: number) => {
    const el = textareaRef.current;
    if (!el || start === end) {
      setToolbarPosition(null);
      return;
    }

    const selection = getTextareaSelectionRect(el, start, end);
    const rect = el.getBoundingClientRect();
    const top = rect.top + selection.top - TOOLBAR_GAP_PX;
    const estimatedToolbarWidth = 260;
    const rawLeft = rect.left + selection.left;
    const left = Math.min(
      Math.max(rawLeft, TOOLBAR_EDGE_PADDING_PX),
      window.innerWidth - estimatedToolbarWidth - TOOLBAR_EDGE_PADDING_PX
    );
    setToolbarPosition({ top, left });
  }, []);

  const syncSelection = useCallback(() => {
    const el = textareaRef.current;
    if (!el) {
      clearFormatToolbar();
      return;
    }
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    selectionRef.current = { start, end };
    if (start === end) {
      clearFormatToolbar();
      return;
    }
    setHasSelection(true);
    updateToolbarPosition(start, end);
  }, [clearFormatToolbar, updateToolbarPosition]);

  const scheduleSyncSelection = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(syncSelection);
    });
  }, [syncSelection]);

  useEffect(() => {
    adjustTextareaHeight();
  }, [draft, adjustTextareaHeight]);

  useEffect(() => {
    if (!conversation || voice.active) return;
    const timer = window.setTimeout(() => textareaRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [conversation?.conversationId, voice.active]);

  useEffect(() => {
    if (voice.active) clearFormatToolbar();
  }, [voice.active, clearFormatToolbar]);

  useEffect(() => {
    if (!hasSelection) return;

    function refreshPosition() {
      const { start, end } = selectionRef.current;
      if (start === end) return;
      updateToolbarPosition(start, end);
    }

    function onSelectionChange() {
      const el = textareaRef.current;
      if (!el) {
        clearFormatToolbar();
        return;
      }
      if (document.activeElement !== el) {
        clearFormatToolbar();
        return;
      }
      syncSelection();
    }

    document.addEventListener("selectionchange", onSelectionChange);
    window.addEventListener("resize", refreshPosition);
    window.addEventListener("scroll", refreshPosition, true);
    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      window.removeEventListener("resize", refreshPosition);
      window.removeEventListener("scroll", refreshPosition, true);
    };
  }, [hasSelection, updateToolbarPosition, syncSelection, clearFormatToolbar]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;

    if (voice.previewBlob) {
      await voice.sendVoiceNote();
      return;
    }

    await onSubmit();
    requestAnimationFrame(adjustTextareaHeight);
  }

  function applyFormat(format: WhatsAppTextFormat) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? selectionRef.current.start;
    const end = el.selectionEnd ?? selectionRef.current.end;
    if (start === end && format !== "ordered" && format !== "unordered" && format !== "quote") {
      return;
    }
    const result = applyWhatsAppTextFormat(draft, start, end, format);
    onDraftChange(result.text);
    selectionRef.current = {
      start: result.selectionStart,
      end: result.selectionEnd,
    };
    const stillSelected = result.selectionStart !== result.selectionEnd;
    setHasSelection(stillSelected);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(result.selectionStart, result.selectionEnd);
      adjustTextareaHeight();
      if (stillSelected) {
        updateToolbarPosition(result.selectionStart, result.selectionEnd);
      } else {
        setToolbarPosition(null);
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && !e.altKey) {
      const key = e.key.toLowerCase();
      if (key === "b") {
        e.preventDefault();
        applyFormat("bold");
        return;
      }
      if (key === "i") {
        e.preventDefault();
        applyFormat("italic");
        return;
      }
      if (key === "x" && e.shiftKey) {
        e.preventDefault();
        applyFormat("strikethrough");
        return;
      }
    }

    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    if (!canSendText) return;
    void handleSubmit(e);
  }

  function insertEmoji(emoji: string) {
    const el = textareaRef.current;
    if (!el) {
      onDraftChange(`${draft}${emoji}`);
      return;
    }
    const start = el.selectionStart ?? draft.length;
    const end = el.selectionEnd ?? draft.length;
    const next = `${draft.slice(0, start)}${emoji}${draft.slice(end)}`;
    onDraftChange(next);
    const cursor = start + emoji.length;
    clearFormatToolbar();
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursor, cursor);
      adjustTextareaHeight();
    });
  }

  const showFormatToolbar = hasSelection && !voice.active && Boolean(toolbarPosition);

  return (
    <form onSubmit={handleSubmit} className="conversations-compose-bar relative py-2 sm:py-3">
      <ComposeFormatToolbar
        visible={showFormatToolbar}
        onFormat={applyFormat}
        position={toolbarPosition}
      />

      <div className="conversations-compose-input overflow-hidden">
        {voice.active ? (
          <VoiceNoteComposeBar voice={voice} sending={sending || attaching} />
        ) : (
          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => {
              onDraftChange(e.target.value);
              scheduleSyncSelection();
            }}
            onKeyDown={handleKeyDown}
            onKeyUp={scheduleSyncSelection}
            onSelect={scheduleSyncSelection}
            onMouseDown={scheduleSyncSelection}
            onMouseUp={scheduleSyncSelection}
            onClick={scheduleSyncSelection}
            onBlur={clearFormatToolbar}
            rows={1}
            placeholder={t("conversations.messagePlaceholderShort")}
            aria-label={t("conversations.messagePlaceholderShort")}
            className={cn(
              "conversations-compose-textarea emoji-text min-h-[44px] resize-none border-0 bg-transparent px-3.5 py-3 shadow-none focus:ring-0",
              scrollable ? "overflow-y-auto" : "overflow-hidden"
            )}
          />
        )}

        <div className="flex items-center gap-1 border-t border-default/60 px-2 py-1.5">
          {conversation && !voice.recording ? <EmojiPicker onInsert={insertEmoji} /> : null}

          {conversation && !voice.recording ? (
            <ConversationComposeActionsMenu
              conversation={conversation}
              draft={draft}
              macroPlaceholderContext={macroPlaceholderContext}
              onDraftChange={onDraftChange}
              onOpenQuotation={onOpenQuotation}
              onOpenBooking={onOpenBooking}
              onOpenTask={onOpenTask}
              showBooking={showBooking}
              showAttachment={showAttachment && !voice.active}
              onAttachFile={onAttachFile}
              attaching={attaching}
            />
          ) : null}

          {showAttachment && onSendVoiceNote && !voice.active ? (
            <ConversationVoiceRecorder
              disabled={attaching}
              sending={attaching}
              starting={voice.starting}
              onStart={() => void voice.startRecording()}
            />
          ) : null}

          {!voice.active ? (
            <p className="ml-auto hidden text-[11px] text-muted sm:block">
              {t("conversations.composeInputHint")}
            </p>
          ) : (
            <p className="ml-auto text-[11px] text-muted">
              {voice.recording
                ? t("conversations.voiceNoteRecordingHint")
                : t("conversations.voiceNotePreviewHint")}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSend}
            aria-label={
              voice.previewBlob
                ? t("conversations.voiceNoteSend")
                : t("conversations.send")
            }
            className={cn(
              "conversations-send-btn ml-1 inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-all disabled:cursor-not-allowed sm:ml-2",
              canSend && "conversations-send-btn--active"
            )}
          >
            {sending || attaching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
