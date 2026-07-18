import type { ApiDocEndpoint } from "@/lib/api-docs/endpoints";
import { useT } from "@/i18n/context";
import { CodeBlock } from "./CodeBlock";

const METHOD_STYLES: Record<string, string> = {
  GET: "bg-blue-100 text-blue-700",
  POST: "bg-green-100 text-green-700",
  PUT: "bg-amber-100 text-amber-700",
};

export function ApiEndpointCard({ endpoint }: { endpoint: ApiDocEndpoint }) {
  const t = useT();

  return (
    <article
      id={endpoint.id}
      className="rounded-xl border border-default bg-surface-elevated p-5 space-y-4 scroll-mt-6"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`px-2 py-0.5 rounded text-xs font-semibold font-mono ${METHOD_STYLES[endpoint.method] ?? "bg-surface-muted text-secondary"}`}
        >
          {endpoint.method}
        </span>
        <code className="text-sm font-mono text-primary">{endpoint.path}</code>
        <span className="text-xs text-muted font-mono ml-auto">{endpoint.scope}</span>
      </div>

      <p className="text-sm text-secondary leading-relaxed">{t(endpoint.descriptionKey)}</p>

      {endpoint.notesKey ? (
        <p className="text-sm text-secondary leading-relaxed">{t(endpoint.notesKey)}</p>
      ) : null}

      {endpoint.requestExample ? (
        <CodeBlock code={endpoint.requestExample} label={t("apiDocs.requestBody")} />
      ) : null}

      <CodeBlock code={endpoint.responseExample} label={t("apiDocs.responseBody")} />

      <CodeBlock code={endpoint.curlExample} label={t("apiDocs.curlExample")} />
    </article>
  );
}
