"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useHelpCenter } from "@/components/help-center/HelpCenterProvider";
import { SetupChecklist } from "@/components/help-center/SetupChecklist";
import { TourList } from "@/components/help-center/TourList";
import { FaqAccordion } from "@/components/support/FaqAccordion";
import { Tabs } from "@/components/ui/Tabs";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";
import type { HelpCenterTab } from "@/hooks/useHelpCenter";

export function HelpCenterPanel() {
  const t = useT();
  const { isOpen, close, activeTab, setActiveTab } = useHelpCenter();

  const tabs: { id: HelpCenterTab; label: string }[] = [
    { id: "checklist", label: t("helpCenter.tabs.checklist") },
    { id: "tours", label: t("helpCenter.tabs.tours") },
    { id: "help", label: t("helpCenter.tabs.help") },
  ];

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={close}
        aria-hidden={!isOpen}
      />

      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-default bg-surface-elevated shadow-xl transition-transform duration-200",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
        aria-hidden={!isOpen}
      >
        <div className="flex items-center justify-between border-b border-default px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-primary">{t("helpCenter.title")}</h2>
            <p className="text-xs text-secondary">{t("helpCenter.subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-lg p-2 text-secondary hover:bg-surface-muted hover:text-primary"
            aria-label={t("helpCenter.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-default px-5 py-3">
          <Tabs items={tabs} value={activeTab} onChange={setActiveTab} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {activeTab === "checklist" ? <SetupChecklist /> : null}
          {activeTab === "tours" ? <TourList /> : null}
          {activeTab === "help" ? (
            <div className="space-y-5">
              <div>
                <h3 className="mb-3 text-sm font-semibold text-primary">{t("helpCenter.faqTitle")}</h3>
                <FaqAccordion />
              </div>
              <Link
                href="/support"
                onClick={close}
                className="inline-flex w-full items-center justify-center rounded-lg border border-default bg-surface px-4 py-2.5 text-sm font-medium text-primary hover:bg-surface-muted"
              >
                {t("helpCenter.contactSupport")}
              </Link>
            </div>
          ) : null}
        </div>
      </aside>
    </>
  );
}
