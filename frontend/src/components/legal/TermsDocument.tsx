"use client";

import { termsContent, type TermsSection } from "@/content/legal/terms-content";
import { useLocale } from "@/i18n/context";

function TermsSectionBlock({ section }: { section: TermsSection }) {
  const paragraphs = section.paragraphs ?? [];
  const listItems = section.listItems;
  const splitAt = section.listAfterParagraphs ?? 1;

  return (
    <section>
      <h2 className="text-lg font-semibold text-primary mb-2">{section.title}</h2>
      <div className="space-y-3 text-sm text-secondary leading-relaxed">
        {listItems?.length ? (
          <>
            {paragraphs.slice(0, splitAt).map((paragraph, index) => (
              <p key={`before-${index}`}>{paragraph}</p>
            ))}
            <ul className="list-disc pl-5 space-y-1">
              {listItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {paragraphs.slice(splitAt).map((paragraph, index) => (
              <p key={`after-${index}`}>{paragraph}</p>
            ))}
          </>
        ) : (
          paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)
        )}
      </div>
    </section>
  );
}

export function TermsDocument() {
  const locale = useLocale();
  const content = termsContent[locale];

  return (
    <article className="prose prose-sm max-w-none">
      <h1 className="text-2xl font-bold text-primary mb-8">{content.pageTitle}</h1>
      <div className="space-y-6">
        {content.sections.map((section) => (
          <TermsSectionBlock key={section.title} section={section} />
        ))}
      </div>
    </article>
  );
}
