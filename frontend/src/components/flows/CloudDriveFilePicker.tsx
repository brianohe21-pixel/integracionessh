"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, FileText, Folder, Table2, X } from "lucide-react";
import { useT } from "@/i18n/context";
import {
  useCloudDriveConnection,
  useCloudDriveFiles,
  type CloudDriveFileItem,
  type CloudDriveProvider,
} from "@/hooks/useCloudDrive";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";

type TargetType = "document" | "spreadsheet";

const DOCUMENT_MIME = new Set([
  "application/vnd.google-apps.document",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const SPREADSHEET_MIME = new Set([
  "application/vnd.google-apps.spreadsheet",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
]);

function isSelectableFile(file: CloudDriveFileItem, targetType: TargetType): boolean {
  if (file.isFolder) return false;
  const mime = file.mimeType.toLowerCase();
  if (targetType === "spreadsheet") {
    return SPREADSHEET_MIME.has(mime) || mime.includes("spreadsheet") || mime.includes("excel");
  }
  return DOCUMENT_MIME.has(mime) || mime.startsWith("text/");
}

type CloudDriveFilePickerProps = {
  provider: CloudDriveProvider;
  targetType: TargetType;
  value?: string;
  fileName?: string;
  onSelect: (file: { id: string; name: string }) => void;
};

export function CloudDriveFilePicker({
  provider,
  targetType,
  value,
  fileName,
  onSelect,
}: CloudDriveFilePickerProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [folderStack, setFolderStack] = useState<Array<{ id: string; name: string }>>([]);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");

  const connection = useCloudDriveConnection(provider);
  const connected = Boolean(connection.data?.connected);
  const currentFolderId = folderStack[folderStack.length - 1]?.id;

  const filesQuery = useCloudDriveFiles(provider, {
    folderId: currentFolderId,
    query: query || undefined,
    enabled: open && connected,
  });

  const files = useMemo(() => {
    const items = filesQuery.data?.files ?? [];
    return items.filter((file) => file.isFolder || isSelectableFile(file, targetType));
  }, [filesQuery.data?.files, targetType]);

  const appsHref = provider === "google-drive" ? "/apps/google-drive" : "/apps/onedrive";
  const selectedLabel = fileName?.trim() || value?.trim() || "";

  function handleOpen() {
    setFolderStack([]);
    setSearchInput("");
    setQuery("");
    setOpen(true);
  }

  function handlePick(file: CloudDriveFileItem) {
    if (file.isFolder) {
      setQuery("");
      setSearchInput("");
      setFolderStack((stack) => [...stack, { id: file.id, name: file.name }]);
      return;
    }
    onSelect({ id: file.id, name: file.name });
    setOpen(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={handleOpen}>
          {t("flows.fields.cloudDrivePickFile")}
        </Button>
        {selectedLabel ? (
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-field-border bg-surface-elevated px-2.5 py-1.5 text-xs text-secondary">
            <span className="truncate">{selectedLabel}</span>
          </span>
        ) : null}
      </div>

      {open ? (
        <Modal className="p-4">
          <div
            className="absolute inset-0"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            className="relative mx-4 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-default bg-surface-elevated shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-default px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-primary">
                  {t("flows.fields.cloudDrivePickFileTitle")}
                </h3>
                <p className="mt-0.5 text-xs text-secondary">
                  {targetType === "spreadsheet"
                    ? t("flows.fields.cloudDrivePickSpreadsheetHint")
                    : t("flows.fields.cloudDrivePickDocumentHint")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-primary"
                aria-label={t("common.close")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 border-b border-default px-4 py-3">
              {!connected ? (
                <p className="text-xs text-secondary">
                  {t("flows.fields.cloudDriveNotConnected")}{" "}
                  <Link href={appsHref} className="font-medium text-accent hover:underline">
                    {t("flows.fields.cloudDriveOpenApps")}
                  </Link>
                </p>
              ) : (
                <>
                  <form
                    className="flex gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      setQuery(searchInput.trim());
                    }}
                  >
                    <input
                      value={searchInput}
                      onChange={(event) => setSearchInput(event.target.value)}
                      placeholder={t("flows.fields.cloudDriveSearchPlaceholder")}
                      className="min-w-0 flex-1 rounded-lg border border-field-border bg-surface-elevated px-3 py-2 text-sm"
                    />
                    <Button type="submit" size="sm" variant="secondary">
                      {t("flows.fields.cloudDriveSearch")}
                    </Button>
                  </form>
                  <div className="flex flex-wrap items-center gap-1 text-[11px] text-secondary">
                    <button
                      type="button"
                      className="rounded px-1.5 py-0.5 hover:bg-surface-muted hover:text-primary"
                      onClick={() => {
                        setFolderStack([]);
                        setQuery("");
                        setSearchInput("");
                      }}
                    >
                      {t("flows.fields.cloudDriveRoot")}
                    </button>
                    {folderStack.map((folder, index) => (
                      <span key={folder.id} className="inline-flex items-center gap-1">
                        <ChevronRight className="h-3 w-3" />
                        <button
                          type="button"
                          className="rounded px-1.5 py-0.5 hover:bg-surface-muted hover:text-primary"
                          onClick={() => setFolderStack((stack) => stack.slice(0, index + 1))}
                        >
                          {folder.name}
                        </button>
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {!connected ? null : filesQuery.isLoading ? (
                <div className="space-y-2 p-2">
                  <div className="h-10 animate-pulse rounded-lg bg-surface-muted" />
                  <div className="h-10 animate-pulse rounded-lg bg-surface-muted" />
                  <div className="h-10 animate-pulse rounded-lg bg-surface-muted" />
                </div>
              ) : filesQuery.isError ? (
                <p className="px-3 py-4 text-sm text-danger">
                  {filesQuery.error instanceof Error
                    ? filesQuery.error.message
                    : t("flows.fields.cloudDriveLoadError")}
                </p>
              ) : files.length === 0 ? (
                <p className="px-3 py-4 text-sm text-secondary">
                  {t("flows.fields.cloudDriveEmpty")}
                </p>
              ) : (
                <ul className="space-y-1">
                  {files.map((file) => {
                    const Icon = file.isFolder
                      ? Folder
                      : targetType === "spreadsheet"
                        ? Table2
                        : FileText;
                    return (
                      <li key={file.id}>
                        <button
                          type="button"
                          onClick={() => handlePick(file)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-surface-muted",
                            value === file.id && "bg-accent/10"
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0 text-secondary" />
                          <span className="min-w-0 flex-1 truncate text-sm text-primary">
                            {file.name}
                          </span>
                          {file.isFolder ? (
                            <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
