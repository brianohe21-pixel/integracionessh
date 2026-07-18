"use client";

import { ArrowLeft, Undo2, Redo2, Maximize2 } from "lucide-react";
import Link from "next/link";
import { useT } from "@/i18n/context";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

type FlowEditorToolbarProps = {
  flowName: string;
  isPublished?: boolean;
  isSaving?: boolean;
  onSave: () => void;
};

export function FlowEditorToolbar({
  flowName,
  isPublished = true,
  isSaving = false,
  onSave,
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
          <Badge variant={isPublished ? "success" : "warning"} className="mt-1">
            {isPublished ? t("flows.published") : t("flows.draft")}
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg border border-default p-2 text-secondary hover:bg-surface-muted"
          aria-label={t("flows.undo")}
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg border border-default p-2 text-secondary hover:bg-surface-muted"
          aria-label={t("flows.redo")}
        >
          <Redo2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg border border-default p-2 text-secondary hover:bg-surface-muted"
          aria-label={t("flows.fullscreen")}
        >
          <Maximize2 className="h-4 w-4" />
        </button>
        <Button type="button" variant="secondary" size="sm">
          {t("flows.preview")}
        </Button>
        <Button type="button" size="sm" onClick={() => onSave()} disabled={isSaving}>
          {t("flows.publishChanges")}
        </Button>
      </div>
    </div>
  );
}
