"use client";

import { useState } from "react";
import { useAuditEvents } from "@/hooks/usePermissions";
import { useFormatters } from "@/hooks/useFormatters";
import { useT } from "@/i18n/context";
import { SelectControl } from "@/components/ui/Input";

const MODULES = ["", "bots", "campaigns", "contacts", "payments", "settings"] as const;

export function ActivityLogCard() {
  const t = useT();
  const { formatDate } = useFormatters();
  const [module, setModule] = useState("");
  const { data, isLoading } = useAuditEvents(module || undefined);
  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <SelectControl value={module} onChange={(event) => setModule(event.target.value)}>
        <option value="">{t("settings.activityAllModules")}</option>
        {MODULES.filter(Boolean).map((item) => (
          <option key={item} value={item}>
            {t(`permissions.modules.${item}`)}
          </option>
        ))}
      </SelectControl>

      {isLoading ? <p className="text-sm text-muted">{t("common.loading")}</p> : null}
      {!isLoading && items.length === 0 ? (
        <p className="text-sm text-secondary">{t("settings.activityEmpty")}</p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-default">
        {items.map((event) => (
          <div
            key={event.eventId}
            className="grid gap-1 border-b border-default px-4 py-3 last:border-b-0 sm:grid-cols-[1.2fr_1fr_1.4fr]"
          >
            <div>
              <p className="text-sm font-medium text-primary">{event.actorEmail}</p>
              <p className="text-xs text-secondary">{formatDate(event.createdAt)}</p>
            </div>
            <p className="text-sm text-primary">
              {t(`permissions.modules.${event.module}`)} · {event.action}
            </p>
            <p className="text-sm text-secondary">{event.summary}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
