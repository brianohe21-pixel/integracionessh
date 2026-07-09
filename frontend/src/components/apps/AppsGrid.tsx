"use client";

import Link from "next/link";
import { Calendar, LayoutGrid } from "lucide-react";
import { useT } from "@/i18n/context";
import type { AppCatalogItem } from "@/types";

const APP_ICONS: Record<string, typeof Calendar> = {
  calendar: Calendar,
};

export function AppsGrid({ apps }: { apps: AppCatalogItem[] }) {
  const t = useT();

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {apps.map((app) => {
        const Icon = APP_ICONS[app.id] ?? LayoutGrid;
        const enabledCount = app.installedBots.filter((b) => b.enabled).length;
        const isCalendar = app.id === "calendar";

        return (
          <div
            key={app.id}
            className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  {app.id === "calendar" ? t("apps.calendarName") : app.name}
                </h3>
                <p className="text-sm text-gray-500">
                  {enabledCount > 0
                    ? t("apps.installedOn", { count: String(enabledCount) })
                    : t("apps.notInstalled")}
                </p>
              </div>
            </div>
            <p className="mb-4 text-sm text-gray-600">
              {app.id === "calendar" ? t("apps.calendarDescription") : app.description}
            </p>
            {isCalendar ? (
              <Link
                href="/apps/calendar"
                className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                {t("apps.configure")}
              </Link>
            ) : (
              <span className="inline-flex rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-500">
                {t("apps.comingSoon")}
              </span>
            )}
          </div>
        );
      })}
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6">
        <p className="text-sm font-medium text-gray-500">{t("apps.comingSoon")}</p>
        <p className="mt-1 text-sm text-gray-400">{t("apps.moreAppsHint")}</p>
      </div>
    </div>
  );
}
