"use client";

import { ChevronRight, List } from "lucide-react";
import { useLocale, useT } from "@/i18n/context";
import { resolveLocalizedText } from "@/lib/localized-text";
import { cn } from "@/lib/utils";
import type { LocalizedText } from "@/types";

export type WhatsAppListPreviewItem = {
  id: string;
  title?: LocalizedText;
  description?: LocalizedText;
};

type Props = {
  messageText?: LocalizedText;
  buttonText?: LocalizedText;
  sectionTitle?: LocalizedText;
  headerText?: LocalizedText;
  footerText?: LocalizedText;
  items?: WhatsAppListPreviewItem[];
  className?: string;
  compact?: boolean;
};

export function WhatsAppListPreview({
  messageText,
  buttonText,
  sectionTitle,
  headerText,
  footerText,
  items = [],
  className,
  compact = false,
}: Props) {
  const t = useT();
  const locale = useLocale();
  const body = resolveLocalizedText(messageText, locale).trim();
  const cta = resolveLocalizedText(buttonText, locale).trim() || t("flows.fields.defaultListButton");
  const section = resolveLocalizedText(sectionTitle, locale).trim();
  const header = resolveLocalizedText(headerText, locale).trim();
  const footer = resolveLocalizedText(footerText, locale).trim();
  const rows = items.length
    ? items
    : [{ id: "placeholder", title: "", description: "" }];

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-[#d1d7db] bg-[#efeae2]",
        className
      )}
    >
      <div className="flex items-center gap-2 border-b border-black/5 bg-[#075e54] px-3 py-2">
        <List className="h-3.5 w-3.5 text-white/90" />
        <p className="text-[11px] font-medium text-white/95">{t("flows.fields.listPreviewTitle")}</p>
      </div>

      <div className={cn("space-y-2 p-3", compact && "p-2.5")}>
        <div className="ml-auto max-w-[92%] rounded-lg rounded-tr-sm bg-[#d9fdd3] px-2.5 py-1.5 shadow-sm">
          {header ? (
            <p className="emoji-text mb-0.5 text-[11px] font-semibold text-[#111b21]">{header}</p>
          ) : null}
          <p className="emoji-text whitespace-pre-wrap text-[12px] leading-snug text-[#111b21]">
            {body || t("flows.fields.defaultButtonPrompt")}
          </p>
          {footer ? (
            <p className="emoji-text mt-1 text-[10px] text-[#667781]">{footer}</p>
          ) : null}
          <div className="mt-2 border-t border-black/10 pt-1.5">
            <div className="flex items-center justify-center gap-1.5 text-[#027eb5]">
              <List className="h-3.5 w-3.5" />
              <span className="emoji-text text-[12px] font-medium">{cta}</span>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="border-b border-[#e9edef] px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#667781]">
              {section || cta}
            </p>
            <p className="mt-0.5 text-[10px] text-[#8696a0]">{t("flows.fields.listPreviewTapHint")}</p>
          </div>
          <ul className={cn("divide-y divide-[#e9edef]", compact && "max-h-40 overflow-y-auto scrollbar-visible")}>
            {rows.map((item, index) => {
              const title =
                resolveLocalizedText(item.title, locale).trim() ||
                `${t("flows.fields.listItem")} ${index + 1}`;
              const description = resolveLocalizedText(item.description, locale).trim();
              return (
                <li
                  key={item.id || `row-${index}`}
                  className="flex items-start gap-2 px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="emoji-text truncate text-[13px] font-medium text-[#111b21]">
                      {title}
                    </p>
                    {description ? (
                      <p className="emoji-text mt-0.5 line-clamp-2 text-[11px] leading-snug text-[#667781]">
                        {description}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-[11px] italic text-[#aebac1]">
                        {t("flows.fields.listItemDescriptionPlaceholder")}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[#8696a0]" />
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
