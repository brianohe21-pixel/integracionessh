"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useT } from "@/i18n/context";
import { Button } from "@/components/ui/Button";
import type { GoogleReview } from "@/hooks/useGoogleBusiness";
import {
  useDeleteGoogleReviewReply,
  useReplyToGoogleReview,
} from "@/hooks/useGoogleBusiness";

type Props = {
  open: boolean;
  review: GoogleReview | null;
  locationId: string;
  onClose: () => void;
};

export function ReviewReplyDrawer({ open, review, locationId, onClose }: Props) {
  const t = useT();
  const replyMutation = useReplyToGoogleReview();
  const deleteMutation = useDeleteGoogleReviewReply();
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!review) return;
    setComment(review.reviewReply?.comment ?? "");
    setError("");
  }, [review]);

  if (!open || !review) return null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!review) return;
    setError("");
    const trimmed = comment.trim();
    if (!trimmed) {
      setError(t("reviewsPage.replyRequired"));
      return;
    }
    try {
      await replyMutation.mutateAsync({
        locationId,
        reviewId: review.reviewId,
        comment: trimmed,
      });
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : t("reviewsPage.replyError")
      );
    }
  }

  async function handleDelete() {
    if (!review) return;
    setError("");
    try {
      await deleteMutation.mutateAsync({
        locationId,
        reviewId: review.reviewId,
      });
      onClose();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : t("reviewsPage.deleteReplyError")
      );
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <button type="button" className="flex-1" aria-label={t("common.close")} onClick={onClose} />
      <aside className="flex h-full w-full max-w-lg flex-col border-l border-default bg-surface-elevated shadow-xl">
        <div className="flex items-center justify-between border-b border-default px-5 py-4">
          <h2 className="text-lg font-semibold text-primary">{t("reviewsPage.replyTitle")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-secondary hover:bg-surface-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-1 flex-col p-5">
          {review.comment ? (
            <div className="mb-4 rounded-lg border border-default bg-surface p-4">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-secondary">
                {t("reviewsPage.customerReview")}
              </p>
              <p className="whitespace-pre-wrap text-sm text-primary">{review.comment}</p>
            </div>
          ) : null}

          <label className="mb-2 block text-sm font-medium text-primary">
            {t("reviewsPage.replyLabel")}
          </label>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={8}
            className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary"
            placeholder={t("reviewsPage.replyPlaceholder")}
          />

          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

          <div className="mt-auto flex flex-wrap gap-3 pt-6">
            <Button type="submit" disabled={replyMutation.isPending}>
              {replyMutation.isPending ? t("reviewsPage.savingReply") : t("reviewsPage.saveReply")}
            </Button>
            {review.reviewReply?.comment ? (
              <Button
                type="button"
                variant="danger"
                onClick={() => void handleDelete()}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending
                  ? t("reviewsPage.deletingReply")
                  : t("reviewsPage.deleteReply")}
              </Button>
            ) : null}
            <Button type="button" variant="secondary" onClick={onClose}>
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      </aside>
    </div>
  );
}
