"use client";

import { useCallback, useEffect, useState } from "react";
import {
  dismissHint as persistDismissHint,
  getCompletedTours,
  getDismissedHints,
  markTourCompleted,
} from "@/lib/help-center/storage";
import type { TourId } from "@/lib/help-center/tours";

export type HelpCenterTab = "checklist" | "tours" | "help";

export function useHelpCenterStorage() {
  const [completedTours, setCompletedTours] = useState<TourId[]>([]);
  const [dismissedHints, setDismissedHints] = useState<string[]>([]);

  useEffect(() => {
    setCompletedTours(getCompletedTours());
    setDismissedHints(getDismissedHints());
  }, []);

  const completeTour = useCallback((tourId: TourId) => {
    markTourCompleted(tourId);
    setCompletedTours(getCompletedTours());
  }, []);

  const dismissHint = useCallback((hintId: string) => {
    persistDismissHint(hintId);
    setDismissedHints(getDismissedHints());
  }, []);

  const isTourCompleted = useCallback(
    (tourId: TourId) => completedTours.includes(tourId),
    [completedTours]
  );

  const isHintDismissed = useCallback(
    (hintId: string) => dismissedHints.includes(hintId),
    [dismissedHints]
  );

  return {
    completedTours,
    dismissedHints,
    completeTour,
    dismissHint,
    isTourCompleted,
    isHintDismissed,
  };
}
