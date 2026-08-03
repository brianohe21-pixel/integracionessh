"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Gauge,
  KeyRound,
  MessageSquare,
  Phone,
  Shield,
  TriangleAlert,
  LayoutTemplate,
} from "lucide-react";
import { API_DOC_ENDPOINTS, type ApiDocEndpoint } from "@/lib/api-docs/endpoints";
import { getApiBaseUrl } from "@/lib/api-docs/constants";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";
import { ApiDocsSection } from "./ApiDocsSection";
import { ApiScopesTable } from "./ApiScopesTable";
import { ApiEndpointCard } from "./ApiEndpointCard";
import { CodeBlock } from "./CodeBlock";

const ERROR_CODES = ["400", "401", "403", "404", "429", "502"] as const;

const ERROR_STYLES: Record<(typeof ERROR_CODES)[number], string> = {
  "400": "bg-warning/12 text-warning",
  "401": "bg-danger/12 text-danger",
  "403": "bg-danger/12 text-danger",
  "404": "bg-surface-muted text-secondary",
  "429": "bg-warning/12 text-warning",
  "502": "bg-danger/12 text-danger",
};

const TOC_SECTIONS = [
  { id: "intro", key: "apiDocs.toc.intro", icon: BookOpen },
  { id: "auth", key: "apiDocs.toc.auth", icon: Shield },
  { id: "scopes", key: "apiDocs.toc.scopes", icon: KeyRound },
  { id: "rate-limit", key: "apiDocs.toc.rateLimit", icon: Gauge },
  { id: "errors", key: "apiDocs.toc.errors", icon: TriangleAlert },
  { id: "endpoints", key: "apiDocs.toc.endpoints", icon: MessageSquare },
] as const;

type EndpointGroup = {
  id: string;
  titleKey: string;
  icon: typeof MessageSquare;
  match: (endpoint: ApiDocEndpoint) => boolean;
};

const ENDPOINT_GROUPS: EndpointGroup[] = [
  {
    id: "messages",
    titleKey: "apiDocs.groups.messages",
    icon: MessageSquare,
    match: (e) => e.path.startsWith("/v1/messages"),
  },
  {
    id: "templates",
    titleKey: "apiDocs.groups.templates",
    icon: LayoutTemplate,
    match: (e) => e.path.startsWith("/v1/templates"),
  },
  {
    id: "calls",
    titleKey: "apiDocs.groups.calls",
    icon: Phone,
    match: (e) => e.path.startsWith("/v1/calls"),
  },
];

export function ApiDocsPage() {
  const t = useT();
  const baseUrl = getApiBaseUrl();
  const [activeSection, setActiveSection] = useState("intro");

  useEffect(() => {
    const ids = TOC_SECTIONS.map((s) => s.id);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target.id) {
          setActiveSection(visible[0].target.id);
        }
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0.1, 0.4, 0.7] }
    );

    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <nav className="sticky top-24 space-y-1">
          <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            {t("apiDocs.onThisPage")}
          </p>
          {TOC_SECTIONS.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-accent-muted font-medium text-accent"
                    : "text-secondary hover:bg-surface-muted hover:text-primary"
                )}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-80" />
                {t(item.key)}
              </a>
            );
          })}
        </nav>
      </aside>

      <article className="min-w-0 space-y-14">
        <header className="relative overflow-hidden rounded-2xl border border-default bg-surface-elevated">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--glow-accent),transparent_55%),linear-gradient(180deg,var(--surface-muted),transparent)]"
          />
          <div className="relative px-6 py-8 sm:px-8 sm:py-10">
            <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-accent/20 bg-accent-muted px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-accent">
              <BookOpen className="h-3.5 w-3.5" />
              REST API
            </div>
            <h1 className="max-w-2xl text-3xl font-bold tracking-tight text-primary sm:text-4xl">
              {t("apiDocs.title")}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-secondary sm:text-base">
              {t("apiDocs.subtitle")}
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="inline-flex min-w-0 items-center gap-2 rounded-xl border border-default bg-surface px-3 py-2">
                <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted">
                  {t("apiDocs.baseUrl")}
                </span>
                <code className="truncate text-xs font-mono text-primary sm:text-sm">{baseUrl}</code>
              </div>
              <Link
                href="/login?redirect=/developer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
              >
                {t("apiDocs.auth.ctaLink")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </header>

        <nav className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
          {TOC_SECTIONS.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="shrink-0 rounded-lg border border-default bg-surface-elevated px-3 py-1.5 text-sm text-secondary hover:border-accent/40 hover:text-accent"
            >
              {t(item.key)}
            </a>
          ))}
        </nav>

        <ApiDocsSection
          id="intro"
          title={t("apiDocs.intro.title")}
          description={t("apiDocs.intro.body")}
        >
          <CodeBlock code={baseUrl} label={t("apiDocs.baseUrl")} />
        </ApiDocsSection>

        <ApiDocsSection
          id="auth"
          title={t("apiDocs.auth.title")}
          description={t("apiDocs.auth.body")}
        >
          <CodeBlock code="X-API-Key: YOUR_API_KEY" label={t("apiDocs.auth.header")} />
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-default bg-surface-muted/70 px-4 py-3 text-sm text-secondary">
            <span>{t("apiDocs.auth.cta")}</span>
            <Link
              href="/login?redirect=/developer"
              className="inline-flex items-center gap-1 font-medium text-accent hover:text-accent-hover"
            >
              {t("apiDocs.auth.ctaLink")}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </ApiDocsSection>

        <ApiDocsSection
          id="scopes"
          title={t("apiDocs.scopes.title")}
          description={t("apiDocs.scopes.body")}
        >
          <ApiScopesTable />
        </ApiDocsSection>

        <ApiDocsSection
          id="rate-limit"
          title={t("apiDocs.rateLimit.title")}
          description={t("apiDocs.rateLimit.body")}
        >
          <CodeBlock
            code={`X-RateLimit-Limit: 60\nX-RateLimit-Remaining: 59\nX-RateLimit-Reset: 1718640060`}
            label={t("apiDocs.rateLimit.headers")}
          />
        </ApiDocsSection>

        <ApiDocsSection
          id="errors"
          title={t("apiDocs.errors.title")}
          description={t("apiDocs.errors.body")}
        >
          <div className="overflow-hidden rounded-xl border border-default">
            <table className="w-full min-w-[360px] text-sm">
              <thead>
                <tr className="border-b border-default bg-surface-muted text-left text-secondary">
                  <th className="py-3 px-4 font-medium">{t("apiDocs.errors.colCode")}</th>
                  <th className="py-3 px-4 font-medium">{t("apiDocs.errors.colMeaning")}</th>
                </tr>
              </thead>
              <tbody>
                {ERROR_CODES.map((code) => (
                  <tr key={code} className="border-b border-subtle last:border-0">
                    <td className="py-3 px-4">
                      <span
                        className={cn(
                          "inline-flex rounded-md px-2 py-0.5 font-mono text-xs font-semibold",
                          ERROR_STYLES[code]
                        )}
                      >
                        {code}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-secondary">
                      {t(`apiDocs.errors.codes.${code}`)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <CodeBlock
            code='{ "error": "Invalid request body" }'
            label={t("apiDocs.errors.example")}
          />
        </ApiDocsSection>

        <ApiDocsSection
          id="endpoints"
          title={t("apiDocs.endpoints.title")}
          description={t("apiDocs.endpoints.body")}
        >
          <div className="space-y-10">
            {ENDPOINT_GROUPS.map((group) => {
              const Icon = group.icon;
              const endpoints = API_DOC_ENDPOINTS.filter(group.match);
              if (!endpoints.length) return null;
              return (
                <div key={group.id} className="space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-muted text-accent">
                      <Icon className="h-4 w-4" />
                    </div>
                    <h3 className="text-base font-semibold text-primary">
                      {t(group.titleKey)}
                    </h3>
                    <span className="rounded-md bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-muted">
                      {endpoints.length}
                    </span>
                  </div>
                  <div className="space-y-4">
                    {endpoints.map((endpoint) => (
                      <ApiEndpointCard key={endpoint.id} endpoint={endpoint} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </ApiDocsSection>
      </article>
    </div>
  );
}
