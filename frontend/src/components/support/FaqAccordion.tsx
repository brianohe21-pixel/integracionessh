"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/context";

const FAQ_KEYS = ["bots", "whatsapp", "templates", "bulkSend", "campaigns", "webhook"] as const;

type FaqKey = (typeof FAQ_KEYS)[number];

export function FaqAccordion() {
  const t = useT();
  const [openKey, setOpenKey] = useState<FaqKey | null>(null);

  function toggle(key: FaqKey) {
    setOpenKey((prev) => (prev === key ? null : key));
  }

  return (
    <div className="divide-y divide-gray-100 border border-subtle rounded-lg overflow-hidden">
      {FAQ_KEYS.map((key) => {
        const open = openKey === key;
        return (
          <div key={key}>
            <button
              type="button"
              onClick={() => toggle(key)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface transition-colors"
            >
              {open ? (
                <ChevronDown className="w-4 h-4 text-muted shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted shrink-0" />
              )}
              <span className="text-sm font-medium text-primary">
                {t(`support.faq.${key}.question`)}
              </span>
            </button>
            <div
              className={cn(
                "overflow-hidden transition-all",
                open ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
              )}
            >
              <p className="px-4 pb-4 pl-11 text-sm text-secondary leading-relaxed">
                {t(`support.faq.${key}.answer`)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
