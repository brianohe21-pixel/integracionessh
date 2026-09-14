"use client";

import { privacyContent, type PrivacySection } from "@/content/legal/privacy-content";
import { useLocale } from "@/i18n/context";

function LegalSection({ section }: { section: PrivacySection }) {
  const paragraphs = section.paragraphs ?? [];
  const listItems = section.listItems;
  const splitAt = section.listAfterParagraphs ?? 1;

  return (
    <section>
      <h3 className="text-base font-semibold text-primary mb-2">{section.title}</h3>
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

export function PrivacyDocument() {
  const locale = useLocale();
  const content = privacyContent[locale];

  return (
    <article className="prose prose-sm max-w-none">
      <h1 className="text-2xl font-bold text-primary mb-8">{content.pageTitle}</h1>

      <div className="space-y-10">
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-primary">{content.policy.title}</h2>
          <p className="text-sm text-secondary leading-relaxed">{content.policy.intro}</p>
          <div className="space-y-6">
            {content.policy.sections.map((section) => (
              <LegalSection key={section.title} section={section} />
            ))}
          </div>
          <p className="text-sm text-secondary">{content.policy.updated}</p>
          <LegalSection section={content.policy.contact} />
        </div>

        <hr className="border-default" />

        <div className="space-y-6">
          <h2 className="text-xl font-bold text-primary">{content.dataTreatment.title}</h2>
          <p className="text-sm text-secondary leading-relaxed">{content.dataTreatment.subtitle}</p>
          <h3 className="text-base font-semibold text-primary">
            {content.dataTreatment.introductionTitle}
          </h3>
          <div className="space-y-3 text-sm text-secondary leading-relaxed">
            {content.dataTreatment.introduction.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
          <div className="space-y-8">
            {content.dataTreatment.chapters.map((chapter) => (
              <div key={chapter.title} className="space-y-5">
                <h3 className="text-lg font-semibold text-primary">{chapter.title}</h3>
                <div className="space-y-5">
                  {chapter.sections.map((section) => (
                    <LegalSection key={section.title} section={section} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm text-secondary">{content.dataTreatment.effectiveDate}</p>
        </div>
      </div>
    </article>
  );
}
