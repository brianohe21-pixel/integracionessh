"use client";

import { useState } from "react";
import type { ApiDocEndpoint } from "@/lib/api-docs/endpoints";
import { useT } from "@/i18n/context";
import { CodeBlock } from "./CodeBlock";
import { cn } from "@/lib/utils";

const METHOD_STYLES: Record<string, string> = {
  GET: "bg-info/12 text-info ring-info/20",
  POST: "bg-success/12 text-success ring-success/20",
  PUT: "bg-warning/12 text-warning ring-warning/20",
  DELETE: "bg-danger/12 text-danger ring-danger/20",
};

type TabId = "request" | "response" | "curl";

export function ApiEndpointCard({ endpoint }: { endpoint: ApiDocEndpoint }) {
  const t = useT();
  const hasRequest = Boolean(endpoint.requestExample);
  const allTabs: { id: TabId; label: string; visible: boolean }[] = [
    { id: "request", label: t("apiDocs.requestBody"), visible: hasRequest },
    { id: "response", label: t("apiDocs.responseBody"), visible: true },
    { id: "curl", label: t("apiDocs.curlExample"), visible: true },
  ];
  const tabs = allTabs.filter((tab) => tab.visible);

  const [activeTab, setActiveTab] = useState<TabId>(tabs[0]?.id ?? "curl");

  const activeCode =
    activeTab === "request"
      ? endpoint.requestExample ?? ""
      : activeTab === "response"
        ? endpoint.responseExample
        : endpoint.curlExample;

  const showEmptyResponse = activeTab === "response" && !endpoint.responseExample;

  return (
    <article
      id={endpoint.id}
      className="scroll-mt-24 overflow-hidden rounded-2xl border border-default bg-surface-elevated shadow-sm shadow-black/[0.02]"
    >
      <div className="border-b border-subtle bg-surface-muted/60 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <span
            className={cn(
              "inline-flex min-w-[4.25rem] items-center justify-center rounded-md px-2 py-1 text-[11px] font-bold tracking-wide font-mono ring-1 ring-inset",
              METHOD_STYLES[endpoint.method] ?? "bg-surface-muted text-secondary ring-default"
            )}
          >
            {endpoint.method}
          </span>
          <code className="text-[13px] font-mono font-medium text-primary">{endpoint.path}</code>
          <span className="ml-auto inline-flex items-center rounded-md bg-accent-muted px-2 py-1 text-[11px] font-mono font-medium text-accent">
            {endpoint.scope}
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-secondary">
          {t(endpoint.descriptionKey)}
        </p>
        {endpoint.notesKey ? (
          <p className="mt-2 rounded-lg border border-accent/15 bg-accent-muted/50 px-3 py-2 text-sm leading-relaxed text-secondary">
            {t(endpoint.notesKey)}
          </p>
        ) : null}
      </div>

      <div className="px-5 pt-3">
        <div className="flex gap-1 border-b border-subtle">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative -mb-px px-3 py-2.5 text-xs font-medium transition-colors",
                activeTab === tab.id
                  ? "text-accent"
                  : "text-muted hover:text-secondary"
              )}
            >
              {tab.label}
              {activeTab === tab.id ? (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" />
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 pt-4">
        {showEmptyResponse ? (
          <p className="rounded-xl border border-dashed border-default bg-surface-muted/50 px-4 py-6 text-center text-sm text-muted">
            {t("apiDocs.noContentResponse")}
          </p>
        ) : (
          <CodeBlock code={activeCode} />
        )}
      </div>
    </article>
  );
}
