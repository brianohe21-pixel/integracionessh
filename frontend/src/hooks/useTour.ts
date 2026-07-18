"use client";

import { useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { driver } from "driver.js";
import { useHelpCenter } from "@/components/help-center/HelpCenterProvider";
import { useT } from "@/i18n/context";
import { getTourById, type TourId } from "@/lib/help-center/tours";

export function useTour() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const { completeTour, close } = useHelpCenter();

  const startTour = useCallback(
    (tourId: TourId) => {
      const tour = getTourById(tourId);
      if (!tour) return;

      const run = () => {
        const availableSteps = tour.steps.filter((step) => {
          if (typeof document === "undefined") return false;
          return Boolean(document.querySelector(step.element));
        });

        if (availableSteps.length === 0) return;

        close();

        const driverObj = driver({
          showProgress: true,
          progressText: t("helpCenter.tourProgress", {
            current: "{{current}}",
            total: "{{total}}",
          }),
          nextBtnText: t("helpCenter.tourNext"),
          prevBtnText: t("helpCenter.tourPrev"),
          doneBtnText: t("helpCenter.tourDone"),
          steps: availableSteps.map((step) => ({
            element: step.element,
            popover: {
              title: t(step.titleKey),
              description: t(step.descriptionKey),
              side: "bottom",
              align: "start",
            },
          })),
          onDestroyed: () => {
            completeTour(tourId);
          },
        });

        driverObj.drive();
      };

      if (pathname !== tour.route) {
        router.push(tour.route);
        window.setTimeout(run, 500);
        return;
      }

      run();
    },
    [t, router, pathname, completeTour, close]
  );

  return { startTour };
}
