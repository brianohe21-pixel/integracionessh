"use client";

import { useState } from "react";
import { MessageSquare, Pencil, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { useDialog } from "@/components/ui/DialogProvider";
import {
  useCreateSalesTaskComment,
  useDeleteSalesTaskComment,
  useSalesTaskComments,
  useUpdateSalesTaskComment,
} from "@/hooks/useSales";
import { useT } from "@/i18n/context";
import type { SalesTaskComment } from "@/types";

type Props = {
  taskId: string;
};

export function TaskCommentsPanel({ taskId }: Props) {
  const t = useT();
  const { confirm } = useDialog();
  const [draft, setDraft] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const { data, isLoading } = useSalesTaskComments(taskId, true);
  const createComment = useCreateSalesTaskComment();
  const updateComment = useUpdateSalesTaskComment();
  const deleteComment = useDeleteSalesTaskComment();
  const comments = data?.items ?? [];

  async function handleSubmit() {
    const body = draft.trim();
    if (!body || createComment.isPending) return;
    await createComment.mutateAsync({ taskId, body });
    setDraft("");
  }

  function startEdit(comment: SalesTaskComment) {
    setEditingCommentId(comment.commentId);
    setEditDraft(comment.body);
  }

  function cancelEdit() {
    setEditingCommentId(null);
    setEditDraft("");
  }

  async function handleSaveEdit(commentId: string) {
    const body = editDraft.trim();
    if (!body || updateComment.isPending) return;
    await updateComment.mutateAsync({ taskId, commentId, body });
    cancelEdit();
  }

  async function handleDelete(commentId: string) {
    const ok = await confirm({
      title: t("tasks.commentsDeleteTitle"),
      description: t("tasks.commentsDeleteConfirm"),
      confirmLabel: t("common.delete"),
      tone: "danger",
    });
    if (!ok || deleteComment.isPending) return;
    await deleteComment.mutateAsync({ taskId, commentId });
    if (editingCommentId === commentId) cancelEdit();
  }

  return (
    <div className="mt-4 border-t border-default pt-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
        <MessageSquare className="h-4 w-4 text-secondary" />
        {t("tasks.commentsTitle")}
      </div>

      {isLoading ? (
        <p className="text-xs text-muted">{t("common.loading")}</p>
      ) : comments.length === 0 ? (
        <p className="mb-3 text-xs text-muted">{t("tasks.commentsEmpty")}</p>
      ) : (
        <ul className="mb-3 max-h-56 space-y-2.5 overflow-y-auto">
          {comments.map((comment) => {
            const isEditing = editingCommentId === comment.commentId;
            return (
              <li
                key={comment.commentId}
                className="rounded-xl border border-default bg-surface-muted/60 px-3 py-2.5"
              >
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
                    <span className="font-medium text-secondary">
                      {comment.authorName?.trim() || t("tasks.commentsUnknownAuthor")}
                    </span>
                    <span>·</span>
                    <span>{new Date(comment.createdAt).toLocaleString()}</span>
                    {comment.updatedAt ? (
                      <>
                        <span>·</span>
                        <span>{t("tasks.commentsEdited")}</span>
                      </>
                    ) : null}
                  </div>
                  {!isEditing ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(comment)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-elevated hover:text-primary"
                        aria-label={t("common.edit")}
                        title={t("common.edit")}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(comment.commentId)}
                        disabled={deleteComment.isPending}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                        aria-label={t("common.delete")}
                        title={t("common.delete")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : null}
                </div>
                {isEditing ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      className="min-h-[72px]"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={cancelEdit}
                        disabled={updateComment.isPending}
                      >
                        {t("common.cancel")}
                      </Button>
                      <Button
                        size="sm"
                        disabled={!editDraft.trim() || updateComment.isPending}
                        onClick={() => void handleSaveEdit(comment.commentId)}
                      >
                        {t("common.save")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-sm text-primary">{comment.body}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-end gap-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("tasks.commentsPlaceholder")}
          className="min-h-[72px] flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void handleSubmit();
            }
          }}
        />
        <Button
          size="sm"
          disabled={!draft.trim() || createComment.isPending}
          onClick={() => void handleSubmit()}
        >
          <Send className="h-4 w-4" />
          {t("tasks.commentsSend")}
        </Button>
      </div>
    </div>
  );
}
