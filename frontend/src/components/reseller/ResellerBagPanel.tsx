"use client";

import { BAG_LIMIT_KEYS, isUnlimitedLimit, type ResellerBag } from "@/lib/subaccount-services";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Layers } from "lucide-react";

export function ResellerBagPanel({ bag }: { bag?: ResellerBag }) {
  const t = useT();
  if (!bag) return null;

  const finite = BAG_LIMIT_KEYS.filter((key) => !isUnlimitedLimit(bag.total[key] ?? 0));
  const unlimited = BAG_LIMIT_KEYS.filter((key) => isUnlimitedLimit(bag.total[key] ?? 0));

  return (
    <section className="content-card space-y-4 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-muted text-accent">
          <Layers className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-primary">{t("reseller.bagTitle")}</h2>
          <p className="mt-0.5 text-sm text-secondary">{t("reseller.bagHint")}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {finite.map((key) => {
          const total = bag.total[key] ?? 0;
          const allocated = bag.allocated[key] ?? 0;
          const remaining = bag.remaining[key] ?? 0;
          const pct = total > 0 ? Math.min(100, (allocated / total) * 100) : 0;
          return (
            <div key={key} className="rounded-xl border border-default bg-surface p-3">
              <p className="text-[11px] font-medium text-secondary">{t(`reseller.limits.${key}`)}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-primary">
                {allocated}
                <span className="text-sm font-medium text-secondary"> / {total}</span>
              </p>
              <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-surface-muted">
                <span
                  className={cn(
                    "block h-full rounded-full",
                    pct >= 90 ? "bg-warning" : "bg-accent"
                  )}
                  style={{ width: `${pct}%` }}
                />
              </span>
              <p className="mt-1.5 text-[11px] text-secondary">
                {t("reseller.bagRemaining", { remaining: String(remaining) })}
              </p>
            </div>
          );
        })}
      </div>

      {unlimited.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-secondary">
            {t("reseller.unlimitedGroup")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {unlimited.map((key) => (
              <Badge key={key} variant="default">
                {t(`reseller.limits.${key}`)}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
