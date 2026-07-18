"use client";

import { useEffect } from "react";
import { CheckCircle, PlayCircle } from "lucide-react";
import { useHelpCenter } from "@/components/help-center/HelpCenterProvider";
import { useTour } from "@/hooks/useTour";
import { TOURS, type TourId } from "@/lib/help-center/tours";
import { useT } from "@/i18n/context";

export function TourList() {
  const t = useT();
  const { isTourCompleted, pendingTourId, clearPendingTour } = useHelpCenter();
  const { startTour } = useTour();

  useEffect(() => {
    if (!pendingTourId) return;
    startTour(pendingTourId);
    clearPendingTour();
  }, [pendingTourId, startTour, clearPendingTour]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-secondary">{t("helpCenter.tours.intro")}</p>
      {TOURS.map((tour) => {
        const completed = isTourCompleted(tour.id);
        return (
          <div
            key={tour.id}
            className="rounded-xl border border-default bg-surface p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-primary">{t(tour.nameKey)}</p>
                <p className="mt-1 text-xs text-secondary">{t(tour.descriptionKey)}</p>
              </div>
              {completed ? (
                <CheckCircle className="h-4 w-4 shrink-0 text-accent" aria-label={t("helpCenter.tourCompleted")} />
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => startTour(tour.id)}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
            >
              <PlayCircle className="h-3.5 w-3.5" />
              {completed ? t("helpCenter.replayTour") : t("helpCenter.startTour")}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function TourPageSuggestion({ tourId }: { tourId: TourId }) {
  const t = useT();
  const { isTourCompleted, isHintDismissed, dismissHint, requestTour } = useHelpCenter();
  const hintId = `tour-suggest-${tourId}`;

  if (isTourCompleted(tourId) || isHintDismissed(hintId)) return null;

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-xl border border-accent/30 bg-accent-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-primary">{t(`helpCenter.hints.tourSuggest.${tourId}`)}</p>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => requestTour(tourId)}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover"
        >
          {t("helpCenter.startTour")}
        </button>
        <button
          type="button"
          onClick={() => dismissHint(hintId)}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-secondary hover:text-primary"
        >
          {t("helpCenter.hints.dismiss")}
        </button>
      </div>
    </div>
  );
}
