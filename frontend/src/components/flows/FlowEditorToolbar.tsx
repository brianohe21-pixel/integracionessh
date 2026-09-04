"use client";

import { ArrowLeft, Copy, Undo2, Redo2, Maximize2, Minimize2, Upload } from "lucide-react";
import Link from "next/link";
import { useT } from "@/i18n/context";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

type FlowEditorToolbarProps = {
  flowName: string;
  isPublished?: boolean;
  version?: number;
  hasUnpublishedChanges?: boolean;
  isSaving?: boolean;
  isPublishing?: boolean;
  isToggling?: boolean;
  isDuplicating?: boolean;
  isDirty?: boolean;
  justSaved?: boolean;
  justPublished?: boolean;
  onSave: () => void;
  onPublish?: () => void;
  publishDisabled?: boolean;
  onToggleEnabled?: () => void;
  onDuplicate?: () => void;
  onPreview?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
};

export function FlowEditorToolbar({
  flowName,
  isPublished = true,
  version = 0,
  hasUnpublishedChanges = false,
  isSaving = false,
  isPublishing = false,
  isToggling = false,
  isDuplicating = false,
  isDirty = false,
  justSaved = false,
  justPublished = false,
  onSave,
  onPublish,
  publishDisabled = false,
  onToggleEnabled,
  onDuplicate,
  onPreview,
  isFullscreen = false,
  onToggleFullscreen,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
}: FlowEditorToolbarProps) {
  const t = useT();

  return (
    <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 border-b border-default bg-surface-elevated px-3 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href="/flows"
          className="inline-flex items-center justify-center rounded-lg border border-default p-2 text-secondary hover:bg-surface-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-primary">{flowName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant={isPublished ? "success" : "warning"}>
              {isPublished ? t("flows.enabled") : t("flows.disabled")}
            </Badge>
            {onToggleEnabled ? (
              <button
                type="button"
                role="switch"
                aria-checked={isPublished}
                aria-label={isPublished ? t("flows.disable") : t("flows.enable")}
                disabled={isToggling}
                onClick={onToggleEnabled}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${
                  isPublished ? "bg-accent" : "bg-surface-muted"
                } ${isToggling ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-surface-elevated shadow transition ${
                    isPublished ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            ) : null}
            <span className="text-[11px] font-medium text-secondary">
              {version > 0 ? t("flows.versionLabel", { version }) : t("flows.notPublished")}
            </span>
            {hasUnpublishedChanges ? (
              <span className="text-[11px] font-medium text-warning">
                {t("flows.unpublishedChanges")}
              </span>
            ) : null}
            <span className="min-w-[7.5rem] text-[11px] font-medium leading-5">
              {isSaving ? (
                <span className="text-secondary">{t("common.saving")}</span>
              ) : isDirty ? (
                <span className="text-warning">{t("flows.unsaved")}</span>
              ) : justPublished ? (
                <span className="text-success">{t("flows.publishedSuccess")}</span>
              ) : justSaved ? (
                <span className="text-success">{t("flows.saved")}</span>
              ) : null}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="inline-flex items-center justify-center rounded-lg border border-default p-2 text-secondary hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={t("flows.undo")}
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className="inline-flex items-center justify-center rounded-lg border border-default p-2 text-secondary hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={t("flows.redo")}
        >
          <Redo2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onToggleFullscreen}
          className="inline-flex items-center justify-center rounded-lg border border-default p-2 text-secondary hover:bg-surface-muted"
          aria-label={isFullscreen ? t("flows.exitFullscreen") : t("flows.fullscreen")}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
        {onDuplicate ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onDuplicate}
            disabled={isDuplicating}
          >
            <Copy className="h-3.5 w-3.5" />
            {isDuplicating ? t("flows.duplicating") : t("flows.duplicate")}
          </Button>
        ) : null}
        <Button type="button" variant="secondary" size="sm" onClick={onPreview}>
          {t("flows.preview")}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => onSave()} disabled={isSaving || !isDirty}>
          {isSaving ? t("common.saving") : t("flows.save")}
        </Button>
        {onPublish ? (
          <Button
            type="button"
            size="sm"
            onClick={onPublish}
            disabled={publishDisabled || isPublishing}
          >
            <Upload className="h-3.5 w-3.5" />
            {isPublishing ? t("flows.publishing") : t("flows.publishChanges")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
