"use client";

import Link from "next/link";
import { API_DOC_ENDPOINTS } from "@/lib/api-docs/endpoints";
import { getApiBaseUrl } from "@/lib/api-docs/constants";
import { useT } from "@/i18n/context";
import { ApiDocsSection } from "./ApiDocsSection";
import { ApiScopesTable } from "./ApiScopesTable";
import { ApiEndpointCard } from "./ApiEndpointCard";
import { CodeBlock } from "./CodeBlock";

const ERROR_CODES = ["400", "401", "403", "404", "429", "502"] as const;

const TOC_SECTIONS = [
  { id: "intro", key: "apiDocs.toc.intro" },
  { id: "auth", key: "apiDocs.toc.auth" },
  { id: "scopes", key: "apiDocs.toc.scopes" },
  { id: "rate-limit", key: "apiDocs.toc.rateLimit" },
  { id: "errors", key: "apiDocs.toc.errors" },
  { id: "endpoints", key: "apiDocs.toc.endpoints" },
] as const;

export function ApiDocsPage() {
  const t = useT();
  const baseUrl = getApiBaseUrl();

  return (
    <article className="space-y-10">
      <header>
        <h1 className="text-2xl font-bold text-primary mb-2">{t("apiDocs.title")}</h1>
        <p className="text-sm text-secondary">{t("apiDocs.subtitle")}</p>
      </header>

      <nav className="flex flex-wrap gap-2 text-sm">
        {TOC_SECTIONS.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className="px-3 py-1.5 rounded-full bg-surface-muted text-secondary hover:bg-accent-muted hover:text-accent transition-colors"
          >
            {t(item.key)}
          </a>
        ))}
      </nav>

      <ApiDocsSection id="intro" title={t("apiDocs.intro.title")}>
        <p className="text-sm text-secondary leading-relaxed whitespace-pre-line">
          {t("apiDocs.intro.body")}
        </p>
        <CodeBlock code={baseUrl} label={t("apiDocs.baseUrl")} />
      </ApiDocsSection>

      <ApiDocsSection id="auth" title={t("apiDocs.auth.title")}>
        <p className="text-sm text-secondary leading-relaxed whitespace-pre-line">
          {t("apiDocs.auth.body")}
        </p>
        <CodeBlock code='X-API-Key: YOUR_API_KEY' label={t("apiDocs.auth.header")} />
        <p className="text-sm text-secondary">
          {t("apiDocs.auth.cta")}{" "}
          <Link href="/login?redirect=/developer" className="text-accent hover:text-accent font-medium">
            {t("apiDocs.auth.ctaLink")}
          </Link>
        </p>
      </ApiDocsSection>

      <ApiDocsSection id="scopes" title={t("apiDocs.scopes.title")}>
        <p className="text-sm text-secondary leading-relaxed">{t("apiDocs.scopes.body")}</p>
        <ApiScopesTable />
      </ApiDocsSection>

      <ApiDocsSection id="rate-limit" title={t("apiDocs.rateLimit.title")}>
        <p className="text-sm text-secondary leading-relaxed whitespace-pre-line">
          {t("apiDocs.rateLimit.body")}
        </p>
        <CodeBlock
          code={`X-RateLimit-Limit: 60\nX-RateLimit-Remaining: 59\nX-RateLimit-Reset: 1718640060`}
          label={t("apiDocs.rateLimit.headers")}
        />
      </ApiDocsSection>

      <ApiDocsSection id="errors" title={t("apiDocs.errors.title")}>
        <p className="text-sm text-secondary leading-relaxed">{t("apiDocs.errors.body")}</p>
        <div className="overflow-x-auto rounded-lg border border-default">
          <table className="w-full min-w-[360px] text-sm">
            <thead>
              <tr className="border-b border-default bg-surface text-left text-secondary">
                <th className="py-2.5 px-4 font-medium">{t("apiDocs.errors.colCode")}</th>
                <th className="py-2.5 px-4 font-medium">{t("apiDocs.errors.colMeaning")}</th>
              </tr>
            </thead>
            <tbody>
              {ERROR_CODES.map((code) => (
                <tr key={code} className="border-b border-subtle last:border-0">
                  <td className="py-2.5 px-4 font-mono text-xs">{code}</td>
                  <td className="py-2.5 px-4 text-secondary">{t(`apiDocs.errors.codes.${code}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <CodeBlock code='{ "error": "Invalid request body" }' label={t("apiDocs.errors.example")} />
      </ApiDocsSection>

      <ApiDocsSection id="endpoints" title={t("apiDocs.endpoints.title")}>
        <p className="text-sm text-secondary leading-relaxed">{t("apiDocs.endpoints.body")}</p>
        <div className="space-y-4">
          {API_DOC_ENDPOINTS.map((endpoint) => (
            <ApiEndpointCard key={endpoint.id} endpoint={endpoint} />
          ))}
        </div>
      </ApiDocsSection>
    </article>
  );
}
