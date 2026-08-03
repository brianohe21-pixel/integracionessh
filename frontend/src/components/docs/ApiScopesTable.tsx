"use client";

import { KeyRound } from "lucide-react";
import { API_SCOPES } from "@/lib/api-docs/constants";
import { useT } from "@/i18n/context";

export function ApiScopesTable() {
  const t = useT();

  return (
    <div className="grid gap-3">
      {API_SCOPES.map((row) => (
        <div
          key={row.scope}
          className="rounded-xl border border-default bg-surface-elevated p-4 transition-colors hover:border-accent/30"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-muted text-accent">
              <KeyRound className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded-md bg-accent-muted px-2 py-0.5 text-xs font-mono font-semibold text-accent">
                  {row.scope}
                </code>
                <span className="text-[11px] uppercase tracking-wide text-muted">
                  {t("apiDocs.scopes.colScope")}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {row.endpoints.map((endpoint) => (
                  <code
                    key={endpoint}
                    className="rounded-md border border-default bg-surface-muted px-2 py-1 text-[11px] font-mono text-secondary"
                  >
                    {endpoint}
                  </code>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
