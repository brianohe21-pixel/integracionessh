"use client";

import { useState } from "react";
import Link from "next/link";
import { useT } from "@/i18n/context";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import { ReviewReplyDrawer } from "@/components/reviews/ReviewReplyDrawer";
import {
  useGoogleBusiness,
  useGoogleReviews,
  type GoogleReview,
} from "@/hooks/useGoogleBusiness";

export function ReviewsList() {
  const t = useT();
  const { data: config, isLoading: configLoading } = useGoogleBusiness();
  const locations = (config?.locations ?? []).filter((location) =>
    (config?.selectedLocationIds ?? []).includes(location.id)
  );
  const [locationId, setLocationId] = useState<string | null>(null);
  const [orderBy, setOrderBy] = useState("updateTime desc");
  const [pageToken, setPageToken] = useState<string | undefined>(undefined);
  const [activeReview, setActiveReview] = useState<GoogleReview | null>(null);

  const activeLocationId = locationId ?? locations[0]?.id ?? null;
  const { data, isLoading, isError, error, refetch, isFetching } = useGoogleReviews(
    activeLocationId,
    { pageToken, orderBy }
  );

  if (configLoading) {
    return <div className="h-48 animate-pulse rounded-xl bg-surface-muted" />;
  }

  if (!config?.configured || !config.enabled) {
    return (
      <div className="rounded-xl border border-default bg-surface-elevated p-8 text-center">
        <p className="mb-4 text-secondary">{t("reviewsPage.notConnected")}</p>
        <Link
          href="/integrations/google-business"
          className="inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        >
          {t("reviewsPage.connectCta")}
        </Link>
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <Alert variant="info">
        {t("reviewsPage.noLocations")}{" "}
        <Link href="/integrations/google-business" className="font-medium text-accent">
          {t("reviewsPage.configureLocations")}
        </Link>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-secondary">
            {t("reviewsPage.location")}
          </label>
          <select
            value={activeLocationId ?? ""}
            onChange={(event) => {
              setLocationId(event.target.value);
              setPageToken(undefined);
            }}
            className="rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary"
          >
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-secondary">
            {t("reviewsPage.sortBy")}
          </label>
          <select
            value={orderBy}
            onChange={(event) => {
              setOrderBy(event.target.value);
              setPageToken(undefined);
            }}
            className="rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary"
          >
            <option value="updateTime desc">{t("reviewsPage.sortNewest")}</option>
            <option value="rating desc">{t("reviewsPage.sortHighest")}</option>
            <option value="rating">{t("reviewsPage.sortLowest")}</option>
          </select>
        </div>

        <Button variant="secondary" onClick={() => void refetch()} disabled={isFetching}>
          {isFetching ? t("reviewsPage.refreshing") : t("reviewsPage.refresh")}
        </Button>
      </div>

      {typeof data?.averageRating === "number" ? (
        <div className="rounded-xl border border-default bg-surface-elevated px-5 py-4 text-sm text-secondary">
          {t("reviewsPage.summary", {
            rating: data.averageRating.toFixed(1),
            count: String(data.totalReviewCount ?? data.reviews.length),
          })}
        </div>
      ) : null}

      {isLoading ? (
        <div className="h-48 animate-pulse rounded-xl bg-surface-muted" />
      ) : isError ? (
        <Alert variant="danger">
          {error instanceof Error ? error.message : t("reviewsPage.loadError")}
        </Alert>
      ) : (data?.reviews.length ?? 0) === 0 ? (
        <Alert variant="info">{t("reviewsPage.empty")}</Alert>
      ) : (
        <div className="space-y-4">
          {data?.reviews.map((review) => (
            <ReviewCard key={review.reviewId} review={review} onReply={setActiveReview} />
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {pageToken ? (
          <Button variant="secondary" onClick={() => setPageToken(undefined)}>
            {t("reviewsPage.firstPage")}
          </Button>
        ) : null}
        {data?.nextPageToken ? (
          <Button variant="secondary" onClick={() => setPageToken(data.nextPageToken)}>
            {t("reviewsPage.nextPage")}
          </Button>
        ) : null}
      </div>

      <ReviewReplyDrawer
        open={Boolean(activeReview)}
        review={activeReview}
        locationId={activeLocationId ?? ""}
        onClose={() => setActiveReview(null)}
      />
    </div>
  );
}
