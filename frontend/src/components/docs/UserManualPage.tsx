"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Bot,
  GitBranch,
  Inbox,
  Layers,
  Rocket,
  TriangleAlert,
} from "lucide-react";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";
import { ApiDocsSection } from "./ApiDocsSection";
import { ManualFigure } from "./ManualFigure";
import { OnboardingMockup } from "./manual-mockups/OnboardingMockup";
import { BotChannelsMockup } from "./manual-mockups/BotChannelsMockup";
import { BotCreateMockup, BotsGridMockup } from "./manual-mockups/BotsMockup";
import { FlowsMockup } from "./manual-mockups/FlowsMockup";
import { InboxMockup } from "./manual-mockups/InboxMockup";

const TOC_SECTIONS = [
  { id: "intro", key: "userManual.toc.intro", icon: BookOpen },
  { id: "getting-started", key: "userManual.toc.gettingStarted", icon: Rocket },
  { id: "bots", key: "userManual.toc.bots", icon: Bot },
  { id: "channels", key: "userManual.toc.channels", icon: Layers },
  { id: "inbox", key: "userManual.toc.inbox", icon: Inbox },
  { id: "flows", key: "userManual.toc.flows", icon: GitBranch },
] as const;

function ManualSteps({ stepKeys }: { stepKeys: readonly string[] }) {
  const t = useT();

  return (
    <ol className="space-y-2">
      {stepKeys.map((key, index) => (
        <li key={key} className="flex gap-3 rounded-xl border border-default bg-surface-muted/40 px-4 py-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-muted text-xs font-semibold text-accent">
            {index + 1}
          </span>
          <span className="text-sm leading-relaxed text-secondary">{t(key)}</span>
        </li>
      ))}
    </ol>
  );
}

function ManualTroubleshooting({ titleKey, bodyKey }: { titleKey: string; bodyKey: string }) {
  const t = useT();

  return (
    <div className="flex gap-3 rounded-xl border border-warning/25 bg-warning/8 px-4 py-3">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
      <div>
        <p className="text-sm font-medium text-primary">{t(titleKey)}</p>
        <p className="mt-1 text-sm leading-relaxed text-secondary">{t(bodyKey)}</p>
      </div>
    </div>
  );
}

export function UserManualPage() {
  const t = useT();
  const [activeSection, setActiveSection] = useState("intro");

  useEffect(() => {
    const ids = TOC_SECTIONS.map((section) => section.id);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target.id) {
          setActiveSection(visible[0].target.id);
        }
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0.1, 0.4, 0.7] }
    );

    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <nav className="sticky top-24 space-y-1">
          <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            {t("userManual.onThisPage")}
          </p>
          {TOC_SECTIONS.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-accent-muted font-medium text-accent"
                    : "text-secondary hover:bg-surface-muted hover:text-primary"
                )}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-80" />
                {t(item.key)}
              </a>
            );
          })}
        </nav>
      </aside>

      <article className="min-w-0 space-y-14">
        <header className="relative overflow-hidden rounded-2xl border border-default bg-surface-elevated">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--glow-accent),transparent_55%),linear-gradient(180deg,var(--surface-muted),transparent)]"
          />
          <div className="relative px-6 py-8 sm:px-8 sm:py-10">
            <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-accent/20 bg-accent-muted px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-accent">
              <BookOpen className="h-3.5 w-3.5" />
              {t("userManual.badge")}
            </div>
            <h1 className="max-w-2xl text-3xl font-bold tracking-tight text-primary sm:text-4xl">
              {t("userManual.title")}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-secondary sm:text-base">
              {t("userManual.subtitle")}
            </p>
            <div className="mt-6">
              <Link
                href="/login?redirect=/onboarding"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
              >
                {t("userManual.cta")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </header>

        <nav className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
          {TOC_SECTIONS.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="shrink-0 rounded-lg border border-default bg-surface-elevated px-3 py-1.5 text-sm text-secondary hover:border-accent/40 hover:text-accent"
            >
              {t(item.key)}
            </a>
          ))}
        </nav>

        <ApiDocsSection
          id="intro"
          title={t("userManual.sections.intro.title")}
          description={t("userManual.sections.intro.body")}
        >
          <ManualSteps
            stepKeys={[
              "userManual.sections.intro.steps.0",
              "userManual.sections.intro.steps.1",
              "userManual.sections.intro.steps.2",
            ]}
          />
        </ApiDocsSection>

        <ApiDocsSection
          id="getting-started"
          title={t("userManual.sections.gettingStarted.title")}
          description={t("userManual.sections.gettingStarted.body")}
        >
          <ManualSteps
            stepKeys={[
              "userManual.sections.gettingStarted.steps.0",
              "userManual.sections.gettingStarted.steps.1",
              "userManual.sections.gettingStarted.steps.2",
              "userManual.sections.gettingStarted.steps.3",
            ]}
          />
          <ManualFigure
            title={t("userManual.figures.onboarding.title")}
            caption={t("userManual.figures.onboarding.caption")}
          >
            <OnboardingMockup />
          </ManualFigure>
          <ManualTroubleshooting
            titleKey="userManual.sections.gettingStarted.troubleshooting.title"
            bodyKey="userManual.sections.gettingStarted.troubleshooting.body"
          />
        </ApiDocsSection>

        <ApiDocsSection
          id="bots"
          title={t("userManual.sections.bots.title")}
          description={t("userManual.sections.bots.body")}
        >
          <ManualSteps
            stepKeys={[
              "userManual.sections.bots.steps.0",
              "userManual.sections.bots.steps.1",
              "userManual.sections.bots.steps.2",
              "userManual.sections.bots.steps.3",
            ]}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <ManualFigure
              title={t("userManual.figures.botsGrid.title")}
              caption={t("userManual.figures.botsGrid.caption")}
            >
              <BotsGridMockup />
            </ManualFigure>
            <ManualFigure
              title={t("userManual.figures.botCreate.title")}
              caption={t("userManual.figures.botCreate.caption")}
            >
              <BotCreateMockup />
            </ManualFigure>
          </div>
          <ManualTroubleshooting
            titleKey="userManual.sections.bots.troubleshooting.title"
            bodyKey="userManual.sections.bots.troubleshooting.body"
          />
        </ApiDocsSection>

        <ApiDocsSection
          id="channels"
          title={t("userManual.sections.channels.title")}
          description={t("userManual.sections.channels.body")}
        >
          <ManualSteps
            stepKeys={[
              "userManual.sections.channels.steps.0",
              "userManual.sections.channels.steps.1",
              "userManual.sections.channels.steps.2",
              "userManual.sections.channels.steps.3",
            ]}
          />
          <ManualFigure
            title={t("userManual.figures.channels.title")}
            caption={t("userManual.figures.channels.caption")}
          >
            <BotChannelsMockup />
          </ManualFigure>
          <ManualTroubleshooting
            titleKey="userManual.sections.channels.troubleshooting.title"
            bodyKey="userManual.sections.channels.troubleshooting.body"
          />
        </ApiDocsSection>

        <ApiDocsSection
          id="inbox"
          title={t("userManual.sections.inbox.title")}
          description={t("userManual.sections.inbox.body")}
        >
          <ManualSteps
            stepKeys={[
              "userManual.sections.inbox.steps.0",
              "userManual.sections.inbox.steps.1",
              "userManual.sections.inbox.steps.2",
              "userManual.sections.inbox.steps.3",
            ]}
          />
          <ManualFigure
            title={t("userManual.figures.inbox.title")}
            caption={t("userManual.figures.inbox.caption")}
          >
            <InboxMockup />
          </ManualFigure>
          <ManualTroubleshooting
            titleKey="userManual.sections.inbox.troubleshooting.title"
            bodyKey="userManual.sections.inbox.troubleshooting.body"
          />
        </ApiDocsSection>

        <ApiDocsSection
          id="flows"
          title={t("userManual.sections.flows.title")}
          description={t("userManual.sections.flows.body")}
        >
          <ManualSteps
            stepKeys={[
              "userManual.sections.flows.steps.0",
              "userManual.sections.flows.steps.1",
              "userManual.sections.flows.steps.2",
              "userManual.sections.flows.steps.3",
            ]}
          />
          <ManualFigure
            title={t("userManual.figures.flows.title")}
            caption={t("userManual.figures.flows.caption")}
          >
            <FlowsMockup />
          </ManualFigure>
          <ManualTroubleshooting
            titleKey="userManual.sections.flows.troubleshooting.title"
            bodyKey="userManual.sections.flows.troubleshooting.body"
          />
        </ApiDocsSection>
      </article>
    </div>
  );
}
