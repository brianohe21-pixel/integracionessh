"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/context";

export type VoiceAgentSideNavItem<T extends string> = {
  id: T;
  label: string;
  icon: ReactNode;
};

interface VoiceAgentSideNavProps<T extends string> {
  tabs: VoiceAgentSideNavItem<T>[];
  activeTab: T;
  onSelect: (tab: T) => void;
  sectionTitle?: string;
  sectionSubtitle?: string;
  variant?: "vertical" | "horizontal";
}

export function VoiceAgentSideNav<T extends string>({
  tabs,
  activeTab,
  onSelect,
  sectionTitle,
  sectionSubtitle,
  variant = "vertical",
}: VoiceAgentSideNavProps<T>) {
  const t = useT();
  const title = sectionTitle ?? t("voiceAgents.navSectionTitle");
  const subtitle = sectionSubtitle ?? t("voiceAgents.navSectionSubtitle");

  if (variant === "horizontal") {
    return (
      <>
        <div className="md:hidden">
          <select
            value={activeTab}
            onChange={(event) => onSelect(event.target.value as T)}
            className="w-full rounded-lg border border-default bg-surface-elevated px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {tabs.map((tab) => (
              <option key={tab.id} value={tab.id}>
                {tab.label}
              </option>
            ))}
          </select>
        </div>

        <div className="hidden md:block overflow-x-auto">
          <div className="flex min-w-max gap-1">
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onSelect(tab.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-accent-muted font-semibold text-accent"
                      : "text-secondary hover:bg-surface-muted hover:text-primary"
                  )}
                >
                  <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-5">
      <div className="content-card overflow-hidden lg:hidden">
        <label className="section-header">
          <span className="section-header-title">{title}</span>
          <span className="section-header-subtitle">{subtitle}</span>
        </label>
        <div className="p-4">
          <select
            value={activeTab}
            onChange={(event) => onSelect(event.target.value as T)}
            className="w-full rounded-xl border border-default bg-surface-elevated px-3 py-2.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {tabs.map((tab) => (
              <option key={tab.id} value={tab.id}>
                {tab.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="hidden lg:block">
        <div className="content-card overflow-hidden p-3">
          <div className="mb-3 px-2">
            <p className="text-xs font-semibold text-primary">{title}</p>
            <p className="text-[11px] text-secondary">{subtitle}</p>
          </div>
          <div className="space-y-0.5">
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onSelect(tab.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    active
                      ? "bg-accent-muted font-semibold text-accent"
                      : "text-secondary hover:bg-surface-muted hover:text-primary"
                  )}
                >
                  {tab.icon}
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
