"use client";

import { Star } from "lucide-react";
import { useT } from "@/i18n/context";
import { Button } from "@/components/ui/Button";
import type { GoogleReview } from "@/hooks/useGoogleBusiness";
import { starRatingToNumber } from "@/hooks/useGoogleBusiness";

type Props = {
  review: GoogleReview;
  onReply: (review: GoogleReview) => void;
};

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className={`h-4 w-4 ${
            index < rating ? "fill-amber-400 text-amber-400" : "text-muted"
          }`}
        />
      ))}
    </div>
  );
}

export function ReviewCard({ review, onReply }: Props) {
  const t = useT();
  const rating = starRatingToNumber(review.starRating);
  const reviewerName =
    review.reviewer?.displayName ||
    (review.reviewer?.isAnonymous ? t("reviewsPage.anonymous") : t("reviewsPage.unknownReviewer"));
  const dateLabel = review.updateTime || review.createTime;

  return (
    <article className="rounded-xl border border-default bg-surface-elevated p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-primary">{reviewerName}</p>
          {dateLabel ? (
            <p className="text-sm text-secondary">{new Date(dateLabel).toLocaleString()}</p>
          ) : null}
        </div>
        <Stars rating={rating} />
      </div>

      {review.comment ? (
        <p className="mb-4 whitespace-pre-wrap text-sm text-primary">{review.comment}</p>
      ) : (
        <p className="mb-4 text-sm italic text-secondary">{t("reviewsPage.noComment")}</p>
      )}

      {review.reviewReply?.comment ? (
        <div className="mb-4 rounded-lg border border-default bg-surface p-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-secondary">
            {t("reviewsPage.yourReply")}
          </p>
          <p className="whitespace-pre-wrap text-sm text-primary">{review.reviewReply.comment}</p>
        </div>
      ) : null}

      <Button variant="secondary" onClick={() => onReply(review)}>
        {review.reviewReply?.comment ? t("reviewsPage.editReply") : t("reviewsPage.reply")}
      </Button>
    </article>
  );
}
