"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { useT } from "@/i18n/context";
import {
  useCreateMetaFlow,
  useDeleteMetaFlow,
  useMetaFlow,
  useMetaFlows,
  usePublishMetaFlow,
  useUpdateMetaFlow,
} from "@/hooks/useMetaFlows";
import { MetaFlowEditorPanel } from "@/components/meta-flows/MetaFlowEditorPanel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { MetaFlow, MetaFlowStatus } from "@/types";

type ModalView = "list" | "create" | "edit";

interface MetaFlowsModalProps {
  botId: string;
  selectedFlowId?: string;
  onClose: () => void;
  onSelect: (metaFlowId: string) => void;
  onFlowDeleted?: (metaFlowId: string) => void;
}

function statusVariant(status: MetaFlowStatus): "success" | "warning" | "default" {
  if (status === "PUBLISHED") return "success";
  if (status === "DRAFT") return "warning";
  return "default";
}

function statusLabel(status: MetaFlowStatus, t: ReturnType<typeof useT>): string {
  if (status === "PUBLISHED") return t("metaFlows.statusPublished");
  if (status === "DRAFT") return t("metaFlows.statusDraft");
  return t("metaFlows.statusDeprecated");
}

export function MetaFlowsModal({
  botId,
  selectedFlowId,
  onClose,
  onSelect,
  onFlowDeleted,
}: MetaFlowsModalProps) {
  const t = useT();
  const [view, setView] = useState<ModalView>("list");
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);
  const [sync, setSync] = useState(false);

  const { data: flows, isLoading, refetch, isFetching } = useMetaFlows(botId, sync);
  const create = useCreateMetaFlow(botId);
  const remove = useDeleteMetaFlow(botId);

  const [createName, setCreateName] = useState("");
  const [createTemplate, setCreateTemplate] = useState<"lead_capture" | "feedback">("lead_capture");
  const [deleteTarget, setDeleteTarget] = useState<Pick<MetaFlow, "metaFlowId" | "name"> | null>(
    null
  );

  function openEdit(flowId: string) {
    setEditingFlowId(flowId);
    setView("edit");
  }

  function handleSync() {
    setSync(true);
    void refetch().finally(() => setSync(false));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const flow = await create.mutateAsync({
      name: createName,
      template: createTemplate,
      categories: ["OTHER"],
    });
    setCreateName("");
    openEdit(flow.metaFlowId);
  }

  function requestDelete(flow: Pick<MetaFlow, "metaFlowId" | "name">) {
    setDeleteTarget(flow);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    remove.mutate(deleteTarget.metaFlowId, {
      onSuccess: () => {
        onFlowDeleted?.(deleteTarget.metaFlowId);
        if (editingFlowId === deleteTarget.metaFlowId) {
          setEditingFlowId(null);
          setView("list");
        }
        setDeleteTarget(null);
      },
    });
  }

  return (
    <>
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(90dvh,720px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-default bg-surface-elevated shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-default px-5 py-4">
          <div className="flex min-w-0 items-center gap-2">
            {view !== "list" && (
              <button
                type="button"
                onClick={() => {
                  setView("list");
                  setEditingFlowId(null);
                }}
                className="rounded-lg p-1.5 text-secondary hover:bg-surface-muted"
                aria-label={t("metaFlows.back")}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-primary">
                {view === "create"
                  ? t("metaFlows.new")
                  : view === "edit"
                    ? t("metaFlows.edit")
                    : t("metaFlows.title")}
              </h2>
              {view === "list" && (
                <p className="truncate text-xs text-secondary">{t("metaFlows.subtitle")}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-secondary"
            aria-label={t("metaFlows.close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {view === "list" && (
            <ListView
              flows={flows}
              isLoading={isLoading}
              isFetching={isFetching}
              selectedFlowId={selectedFlowId}
              onCreate={() => setView("create")}
              onEdit={openEdit}
              onSelect={(flowId) => {
                onSelect(flowId);
                onClose();
              }}
              onSync={handleSync}
              onDelete={requestDelete}
              isDeleting={remove.isPending}
              deleteError={remove.error?.message}
              statusLabel={(status) => statusLabel(status, t)}
              statusVariant={statusVariant}
            />
          )}

          {view === "create" && (
            <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-secondary">
                  {t("flows.colName")}
                </label>
                <input
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-default p-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-secondary">Template</label>
                <select
                  value={createTemplate}
                  onChange={(e) => setCreateTemplate(e.target.value as "lead_capture" | "feedback")}
                  className="w-full rounded-lg border border-default bg-surface-elevated p-2 text-sm"
                >
                  <option value="lead_capture">{t("metaFlows.templateLead")}</option>
                  <option value="feedback">{t("metaFlows.templateFeedback")}</option>
                </select>
              </div>
              {create.isError && (
                <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                  {create.error.message}
                </p>
              )}
              <Button type="submit" disabled={create.isPending} className="w-full">
                {create.isPending ? t("common.loading") : t("metaFlows.new")}
              </Button>
            </form>
          )}

          {view === "edit" && editingFlowId && (
            <EditView
              botId={botId}
              flowId={editingFlowId}
              onSelect={(flowId) => {
                onSelect(flowId);
                onClose();
              }}
              onPublished={() => void refetch()}
              onDelete={requestDelete}
              isDeleting={remove.isPending}
            />
          )}
        </div>
      </div>
    </div>

    <MetaFlowDeleteDialog
      flow={deleteTarget}
      isPending={remove.isPending}
      onClose={() => setDeleteTarget(null)}
      onConfirm={confirmDelete}
    />
    </>
  );
}

function MetaFlowDeleteDialog({
  flow,
  isPending,
  onClose,
  onConfirm,
}: {
  flow: Pick<MetaFlow, "metaFlowId" | "name"> | null;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const t = useT();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (flow) {
      if (!dialog.open) dialog.showModal();
      return;
    }
    if (dialog.open) dialog.close();
  }, [flow]);

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={onClose}
      className="w-full max-w-sm rounded-2xl border border-default bg-surface-elevated p-0 shadow-xl backdrop:bg-black/40"
    >
      {flow && (
        <>
          <div className="px-6 py-5">
            <h2 className="mb-2 text-lg font-semibold text-primary">{t("metaFlows.deleteTitle")}</h2>
            <p className="text-sm text-secondary">
              {t("metaFlows.deleteConfirm", { name: flow.name })}
            </p>
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-default px-6 py-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
              {t("common.cancel")}
            </Button>
            <Button type="button" variant="danger" onClick={onConfirm} disabled={isPending}>
              {isPending ? t("common.loading") : t("common.delete")}
            </Button>
          </div>
        </>
      )}
    </dialog>
  );
}

function ListView({
  flows,
  isLoading,
  isFetching,
  selectedFlowId,
  onCreate,
  onEdit,
  onSelect,
  onSync,
  onDelete,
  isDeleting,
  deleteError,
  statusLabel,
  statusVariant,
}: {
  flows?: MetaFlow[];
  isLoading: boolean;
  isFetching: boolean;
  selectedFlowId?: string;
  onCreate: () => void;
  onEdit: (flowId: string) => void;
  onSelect: (flowId: string) => void;
  onSync: () => void;
  onDelete: (flow: MetaFlow) => void;
  isDeleting: boolean;
  deleteError?: string;
  statusLabel: (status: MetaFlowStatus) => string;
  statusVariant: (status: MetaFlowStatus) => "success" | "warning" | "default";
}) {
  const t = useT();

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-xl bg-surface-muted" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={onSync} disabled={isFetching}>
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          {t("metaFlows.sync")}
        </Button>
        <Button size="sm" onClick={onCreate}>
          <Plus className="h-3.5 w-3.5" />
          {t("metaFlows.new")}
        </Button>
      </div>

      {!flows?.length ? (
        <p className="text-sm text-secondary">{t("metaFlows.empty")}</p>
      ) : (
        <ul className="divide-y divide-subtle overflow-hidden rounded-xl border border-default">
          {flows.map((flow) => {
            const isSelected = flow.metaFlowId === selectedFlowId;
            return (
              <li
                key={flow.metaFlowId}
                className={`flex items-center gap-3 px-4 py-3 ${isSelected ? "bg-accent-muted/40" : ""}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-primary">{flow.name}</p>
                  <Badge variant={statusVariant(flow.status)} className="mt-1">
                    {statusLabel(flow.status)}
                  </Badge>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(flow.metaFlowId)}>
                    {t("metaFlows.edit")}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => onSelect(flow.metaFlowId)}
                    disabled={flow.status !== "PUBLISHED"}
                  >
                    {t("metaFlows.select")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-danger hover:bg-danger/10 hover:text-danger"
                    onClick={() => onDelete(flow)}
                    disabled={isDeleting}
                    aria-label={t("common.delete")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {deleteError && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{deleteError}</p>
      )}
    </div>
  );
}

function EditView({
  botId,
  flowId,
  onSelect,
  onPublished,
  onDelete,
  isDeleting,
}: {
  botId: string;
  flowId: string;
  onSelect: (flowId: string) => void;
  onPublished: () => void;
  onDelete: (flow: Pick<MetaFlow, "metaFlowId" | "name">) => void;
  isDeleting: boolean;
}) {
  const t = useT();
  const { data: flow } = useMetaFlow(botId, flowId);
  const update = useUpdateMetaFlow(botId, flowId);
  const publish = usePublishMetaFlow(botId);
  const [jsonText, setJsonText] = useState("{}");

  useEffect(() => {
    if (flow?.jsonDefinition) {
      setJsonText(JSON.stringify(flow.jsonDefinition, null, 2));
    }
  }, [flow]);

  if (!flow) {
    return <div className="h-40 animate-pulse rounded-xl bg-surface-muted" />;
  }

  async function handleSave() {
    const jsonDefinition = JSON.parse(jsonText) as Record<string, unknown>;
    await update.mutateAsync({ jsonDefinition });
  }

  async function handlePublish() {
    try {
      const jsonDefinition = JSON.parse(jsonText) as Record<string, unknown>;
      await update.mutateAsync({ jsonDefinition });
      publish.mutate(flowId, { onSuccess: onPublished });
    } catch {
      /* mutation errors surface below */
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-medium text-primary">{flow.name}</p>
        <Badge variant={statusVariant(flow.status)}>{statusLabel(flow.status, t)}</Badge>
      </div>

      <MetaFlowEditorPanel
        value={jsonText}
        onChange={setJsonText}
        readOnly={flow.status !== "DRAFT"}
      />

      <div className="flex flex-wrap gap-2">
        {flow.status === "DRAFT" && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleSave()}
            disabled={update.isPending}
          >
            {t("flows.save")}
          </Button>
        )}
        {flow.status === "DRAFT" && (
          <Button size="sm" onClick={handlePublish} disabled={publish.isPending}>
            {t("metaFlows.publish")}
          </Button>
        )}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onSelect(flowId)}
          disabled={flow.status !== "PUBLISHED"}
        >
          {t("metaFlows.selectAndClose")}
        </Button>
      </div>

      {update.isError && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {update.error.message}
        </p>
      )}
      {publish.isError && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {publish.error.message}
        </p>
      )}

      {flow.status !== "PUBLISHED" && (
        <p className="text-xs text-warning">{t("metaFlows.publishHint")}</p>
      )}

      <div className="border-t border-default pt-4">
        <Button
          variant="ghost"
          size="sm"
          className="text-danger hover:bg-danger/10 hover:text-danger"
          onClick={() => onDelete({ metaFlowId: flow.metaFlowId, name: flow.name })}
          disabled={isDeleting}
        >
          <Trash2 className="h-3.5 w-3.5" />
          {t("common.delete")}
        </Button>
      </div>
    </div>
  );
}
