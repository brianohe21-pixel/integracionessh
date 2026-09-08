"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ExternalLink, Link2, Pencil, Trash2 } from "lucide-react";
import { useEditorState } from "react-simple-wysiwyg";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useT } from "@/i18n/context";
import {
  getRangeText,
  normalizeUrl,
  readAnchorHref,
  resolveAnchor,
  unwrapAnchor,
} from "@/components/mailrelay/html-editor-link-utils";

type HtmlEditorLinkContextValue = {
  openDialog: (anchor?: HTMLAnchorElement | null) => void;
};

const HtmlEditorLinkContext = createContext<HtmlEditorLinkContextValue | null>(null);

function useHtmlEditorLinkContext() {
  const context = useContext(HtmlEditorLinkContext);
  if (!context) {
    throw new Error("HtmlEditorLink components must be used within HtmlEditorLinkProvider");
  }
  return context;
}

type HtmlEditorLinkProviderProps = {
  children: ReactNode;
  onApplied?: () => void;
};

type PopoverState = {
  anchor: HTMLAnchorElement;
  top: number;
  left: number;
};

const POPOVER_WIDTH = 240;
const POPOVER_GAP = 8;

export function HtmlEditorLinkProvider({ children, onApplied }: HtmlEditorLinkProviderProps) {
  const t = useT();
  const editorState = useEditorState();
  const savedRangeRef = useRef<Range | null>(null);
  const editingAnchorRef = useRef<HTMLAnchorElement | null>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [mounted, setMounted] = useState(false);
  const [url, setUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [error, setError] = useState("");
  const [editingLink, setEditingLink] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!dialogOpen) return;
    const timer = window.setTimeout(() => urlInputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [dialogOpen]);

  const closePopover = useCallback(() => {
    setPopover(null);
  }, []);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setError("");
    editingAnchorRef.current = null;
  }, []);

  const saveSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      savedRangeRef.current = null;
      return;
    }
    savedRangeRef.current = selection.getRangeAt(0).cloneRange();
  }, []);

  const saveAnchorSelection = useCallback((anchor: HTMLAnchorElement) => {
    const range = document.createRange();
    range.selectNodeContents(anchor);
    savedRangeRef.current = range.cloneRange();
    editingAnchorRef.current = anchor;
  }, []);

  const restoreSelection = useCallback(() => {
    const range = savedRangeRef.current;
    const editor = editorState.$el;
    if (!range || !editor) return;
    editor.focus();
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(range);
  }, [editorState.$el]);

  const openDialog = useCallback(
    (anchor?: HTMLAnchorElement | null) => {
      const editor = editorState.$el;
      if (!editor) return;
      closePopover();
      if (anchor && editor.contains(anchor)) {
        saveAnchorSelection(anchor);
      } else {
        if (!editor.contains(document.activeElement)) {
          editor.focus();
        }
        saveSelection();
        const resolved = resolveAnchor(editor, editorState.$selection);
        editingAnchorRef.current = resolved;
      }
      const activeAnchor = editingAnchorRef.current;
      const selectedText = getRangeText(savedRangeRef.current);
      setEditingLink(Boolean(activeAnchor));
      setUrl(activeAnchor ? readAnchorHref(activeAnchor) : "https://");
      setLinkText(activeAnchor?.textContent ?? selectedText);
      setError("");
      setDialogOpen(true);
    },
    [closePopover, editorState.$el, editorState.$selection, saveAnchorSelection, saveSelection]
  );

  const openPopover = useCallback((anchor: HTMLAnchorElement) => {
    saveAnchorSelection(anchor);
    const rect = anchor.getBoundingClientRect();
    const left = Math.min(
      Math.max(POPOVER_GAP, rect.left),
      window.innerWidth - POPOVER_WIDTH - POPOVER_GAP
    );
    const top = Math.min(rect.bottom + POPOVER_GAP, window.innerHeight - POPOVER_GAP);
    setPopover({ anchor, top, left });
  }, [saveAnchorSelection]);

  const insertAnchor = useCallback(
    (editor: HTMLElement, normalizedUrl: string, label: string) => {
      const selection = window.getSelection();
      const range = savedRangeRef.current;
      if (!selection || !range) return;

      const anchor = document.createElement("a");
      anchor.href = normalizedUrl;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.textContent = label;

      range.deleteContents();
      range.insertNode(anchor);
      const afterAnchor = document.createRange();
      afterAnchor.setStartAfter(anchor);
      afterAnchor.collapse(true);
      selection.removeAllRanges();
      selection.addRange(afterAnchor);
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    },
    []
  );

  const removeLink = useCallback(() => {
    const editor = editorState.$el;
    const editingAnchor = editingAnchorRef.current;
    if (editingAnchor && editor?.contains(editingAnchor)) {
      unwrapAnchor(editingAnchor);
    } else {
      restoreSelection();
      document.execCommand("unlink");
    }
    onApplied?.();
    closeDialog();
    closePopover();
  }, [closeDialog, closePopover, editorState.$el, onApplied, restoreSelection]);

  const applyLink = useCallback(() => {
    const normalized = normalizeUrl(url);
    if (!normalized) {
      setError(t("htmlEditor.linkInvalid"));
      return;
    }

    const editor = editorState.$el;
    if (!editor) return;

    const trimmedText = linkText.trim();
    const range = savedRangeRef.current;
    const selectedText = getRangeText(range);
    const editingAnchor = editingAnchorRef.current;

    if (editingAnchor && editor.contains(editingAnchor)) {
      editingAnchor.href = normalized;
      editingAnchor.target = "_blank";
      editingAnchor.rel = "noopener noreferrer";
      if (trimmedText) {
        editingAnchor.textContent = trimmedText;
      } else if (!editingAnchor.textContent?.trim()) {
        editingAnchor.textContent = normalized;
      }
      onApplied?.();
      closeDialog();
      closePopover();
      return;
    }

    restoreSelection();

    if (trimmedText) {
      insertAnchor(editor, normalized, trimmedText);
    } else if (range && !range.collapsed && selectedText) {
      document.execCommand("createLink", false, normalized);
    } else {
      insertAnchor(editor, normalized, normalized);
    }

    onApplied?.();
    closeDialog();
    closePopover();
  }, [
    closeDialog,
    closePopover,
    editorState.$el,
    insertAnchor,
    linkText,
    onApplied,
    restoreSelection,
    t,
    url,
  ]);

  const visitLink = useCallback(
    (anchor: HTMLAnchorElement) => {
      const href = readAnchorHref(anchor);
      if (!href) return;
      window.open(href, "_blank", "noopener,noreferrer");
      closePopover();
    },
    [closePopover]
  );

  useEffect(() => {
    const root = editorState.$el;
    if (!root || editorState.htmlMode) return undefined;

    const editorEl = root;

    function onClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!anchor || !editorEl.contains(anchor)) return;
      event.preventDefault();
      event.stopPropagation();
      openPopover(anchor);
    }

    editorEl.addEventListener("click", onClick);
    return () => editorEl.removeEventListener("click", onClick);
  }, [editorState.$el, editorState.htmlMode, openPopover]);

  useEffect(() => {
    if (!popover) return;
    const activeAnchor = popover.anchor;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (activeAnchor.contains(target)) return;
      closePopover();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closePopover();
    }

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closePopover, popover]);

  useLayoutEffect(() => {
    if (!popover || !popoverRef.current) return;
    const height = popoverRef.current.offsetHeight;
    const maxTop = window.innerHeight - height - POPOVER_GAP;
    if (popover.top > maxTop) {
      const rect = popover.anchor.getBoundingClientRect();
      setPopover((current) =>
        current
          ? {
              ...current,
              top: Math.max(POPOVER_GAP, rect.top - height - POPOVER_GAP),
            }
          : current
      );
    }
  }, [popover]);

  if (editorState.htmlMode) {
    return <>{children}</>;
  }

  return (
    <HtmlEditorLinkContext.Provider value={{ openDialog }}>
      {children}

      {mounted && popover
        ? createPortal(
            <div
              ref={popoverRef}
              className="fixed z-[120] w-60 overflow-hidden rounded-xl border border-default bg-surface-elevated shadow-lg"
              style={{ top: popover.top, left: popover.left }}
              role="menu"
              aria-label={t("htmlEditor.linkActions")}
            >
              <div className="border-b border-default px-3 py-2">
                <p className="truncate text-xs font-medium text-primary">
                  {popover.anchor.textContent?.trim() || t("htmlEditor.link")}
                </p>
                <p className="truncate text-[11px] text-secondary">{readAnchorHref(popover.anchor)}</p>
              </div>
              <div className="p-1">
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-primary hover:bg-surface-muted"
                  onClick={() => visitLink(popover.anchor)}
                >
                  <ExternalLink className="h-4 w-4 text-secondary" />
                  {t("htmlEditor.linkOpen")}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-primary hover:bg-surface-muted"
                  onClick={() => openDialog(popover.anchor)}
                >
                  <Pencil className="h-4 w-4 text-secondary" />
                  {t("common.edit")}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-danger/10"
                  onClick={() => {
                    saveAnchorSelection(popover.anchor);
                    removeLink();
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  {t("htmlEditor.linkRemove")}
                </button>
              </div>
            </div>,
            document.body
          )
        : null}

      {dialogOpen ? (
        <Modal className="p-4">
          <div
            className="w-full max-w-md rounded-2xl border border-default bg-surface-elevated shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="html-editor-link-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-default px-6 py-5">
              <h2 id="html-editor-link-title" className="text-lg font-semibold text-primary">
                {editingLink ? t("htmlEditor.linkEditTitle") : t("htmlEditor.linkTitle")}
              </h2>
              <p className="mt-1 text-sm text-secondary">{t("htmlEditor.linkDescription")}</p>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="space-y-2">
                <label htmlFor="html-editor-link-url" className="text-sm font-medium text-secondary">
                  {t("htmlEditor.linkUrl")}
                </label>
                <Input
                  ref={urlInputRef}
                  id="html-editor-link-url"
                  type="url"
                  value={url}
                  placeholder={t("htmlEditor.linkUrlPlaceholder")}
                  onChange={(event) => {
                    setUrl(event.target.value);
                    if (error) setError("");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      applyLink();
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="html-editor-link-text" className="text-sm font-medium text-secondary">
                  {t("htmlEditor.linkText")}
                </label>
                <Input
                  id="html-editor-link-text"
                  type="text"
                  value={linkText}
                  placeholder={t("htmlEditor.linkTextPlaceholder")}
                  onChange={(event) => setLinkText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      applyLink();
                    }
                  }}
                />
                <p className="text-xs text-secondary">{t("htmlEditor.linkTextHint")}</p>
              </div>
              {error ? <p className="text-sm text-danger">{error}</p> : null}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-default px-6 py-4">
              {editingLink ? (
                <Button type="button" variant="ghost" onClick={removeLink}>
                  {t("htmlEditor.linkRemove")}
                </Button>
              ) : null}
              <Button type="button" variant="ghost" onClick={closeDialog}>
                {t("common.cancel")}
              </Button>
              <Button type="button" variant="primary" onClick={applyLink}>
                {editingLink ? t("htmlEditor.linkUpdate") : t("htmlEditor.linkInsert")}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </HtmlEditorLinkContext.Provider>
  );
}

export function HtmlEditorLinkToolbarButton() {
  const t = useT();
  const editorState = useEditorState();
  const { openDialog } = useHtmlEditorLinkContext();

  if (editorState.htmlMode) return null;

  return (
    <button
      type="button"
      className="rsw-btn"
      title={t("htmlEditor.link")}
      tabIndex={-1}
      onMouseDown={(event) => {
        event.preventDefault();
        openDialog();
      }}
    >
      <Link2 className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
