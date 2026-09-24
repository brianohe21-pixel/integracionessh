"use client";

import { useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { useCreateSalesTaskComment, useSalesTaskComments } from "@/hooks/useSales";
import { useT } from "@/i18n/context";

type Props = {
  taskId: string;
};

export function TaskCommentsPanel({ taskId }: Props) {
  const t = useT();
  const [draft, setDraft] = useState("");
  const { data, isLoading } = useSalesTaskComments(taskId, true);
  const createComment = useCreateSalesTaskComment();
  const comments = data?.items ?? [];

  async function handleSubmit() {
    const body = draft.trim();
    if (!body || createComment.isPending) return;
    await createComment.mutateAsync({ taskId, body });
    setDraft("");
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
        <ul className="mb-3 max-h-48 space-y-2.5 overflow-y-auto">
          {comments.map((comment) => (
            <li
              key={comment.commentId}
              className="rounded-xl border border-default bg-surface-muted/60 px-3 py-2.5"
            >
              <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                <span className="font-medium text-secondary">
                  {comment.authorName?.trim() || t("tasks.commentsUnknownAuthor")}
                </span>
                <span>·</span>
                <span>{new Date(comment.createdAt).toLocaleString()}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-primary">{comment.body}</p>
            </li>
          ))}
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
