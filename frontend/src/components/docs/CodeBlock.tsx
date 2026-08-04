"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";

export function CodeBlock({
  code,
  label,
  className,
}: {
  code: string;
  label?: string;
  className?: string;
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={cn("group relative", className)}>
      {label ? (
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
            {label}
          </p>
        </div>
      ) : null}
      <div className="relative overflow-hidden rounded-xl border border-default bg-[#0c1220] shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-white/8 px-3 py-2">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-white/20" />
            <span className="h-2 w-2 rounded-full bg-white/20" />
            <span className="h-2 w-2 rounded-full bg-white/20" />
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-brand-primary" />
                {t("apiDocs.copied")}
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                {t("apiDocs.copy")}
              </>
            )}
          </button>
        </div>
        <pre className="overflow-x-auto p-4 text-[12.5px] leading-relaxed text-slate-200 font-mono whitespace-pre-wrap break-all">
          {code}
        </pre>
      </div>
    </div>
  );
}
