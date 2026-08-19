"use client";

import { useState } from "react";
import DOMPurify from "isomorphic-dompurify";
import { useT } from "@/i18n/context";

export function EmailHtmlBody({ html }: { html: string }) {
  const sanitized = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
  });

  return (
    <div
      className="prose prose-sm max-w-none text-primary [&_a]:text-accent [&_img]:max-w-full"
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}

export function EmailBodyToggle({
  textBody,
  html,
}: {
  textBody: string;
  html?: string;
}) {
  const t = useT();
  const [mode, setMode] = useState<"html" | "text">(html ? "html" : "text");

  if (!html) {
    return <pre className="whitespace-pre-wrap font-sans text-sm">{textBody}</pre>;
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("html")}
          className={`px-2 py-1 text-xs rounded border ${
            mode === "html" ? "border-accent bg-accent-muted" : "border-default"
          }`}
        >
          {t("emailChannel.viewHtml")}
        </button>
        <button
          type="button"
          onClick={() => setMode("text")}
          className={`px-2 py-1 text-xs rounded border ${
            mode === "text" ? "border-accent bg-accent-muted" : "border-default"
          }`}
        >
          {t("emailChannel.viewText")}
        </button>
      </div>
      {mode === "html" ? <EmailHtmlBody html={html} /> : (
        <pre className="whitespace-pre-wrap font-sans text-sm">{textBody}</pre>
      )}
    </div>
  );
}
