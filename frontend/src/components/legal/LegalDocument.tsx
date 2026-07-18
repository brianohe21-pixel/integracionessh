"use client";

import { useT } from "@/i18n/context";

const SECTION_KEYS = ["intro", "data", "whatsapp", "openai", "cookies", "contact"] as const;

export function LegalDocument({ namespace }: { namespace: "legal.terms" | "legal.privacy" }) {
  const t = useT();

  return (
    <article className="prose prose-sm max-w-none">
      <h1 className="text-2xl font-bold text-primary mb-2">{t(`${namespace}.title`)}</h1>
      <p className="text-sm text-secondary mb-8">{t(`${namespace}.updated`)}</p>
      <div className="space-y-6">
        {SECTION_KEYS.map((key) => (
          <section key={key}>
            <h2 className="text-lg font-semibold text-primary mb-2">
              {t(`${namespace}.sections.${key}.title`)}
            </h2>
            <p className="text-sm text-secondary leading-relaxed whitespace-pre-line">
              {t(`${namespace}.sections.${key}.body`)}
            </p>
          </section>
        ))}
      </div>
    </article>
  );
}
