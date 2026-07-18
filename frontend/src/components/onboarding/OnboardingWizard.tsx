"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, PartyPopper } from "lucide-react";
import { useT } from "@/i18n/context";
import {
  useOnboardingStatus,
  useUpdateOnboarding,
  type OnboardingStep,
} from "@/hooks/useOnboarding";
import { ONBOARDING_STEPS } from "@/lib/onboarding";
import type { BotIndustryTemplateId } from "@/lib/bot-templates";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { OnboardingStepWhatsApp } from "./OnboardingStepWhatsApp";
import { OnboardingStepCreateBot } from "./OnboardingStepCreateBot";
import { OnboardingStepTestMessage } from "./OnboardingStepTestMessage";
import { OnboardingStepActivateFlow } from "./OnboardingStepActivateFlow";

interface WhatsAppCredentials {
  phoneNumberId: string;
  whatsappBusinessAccountId: string;
}

const ONBOARDING_WA_STORAGE_KEY = "onboardingWhatsApp";
const ONBOARDING_TEMPLATE_STORAGE_KEY = "onboardingTemplateId";

function readStoredTemplateId(): BotIndustryTemplateId | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(ONBOARDING_TEMPLATE_STORAGE_KEY);
  if (
    raw === "health" ||
    raw === "retail" ||
    raw === "real_estate" ||
    raw === "support"
  ) {
    return raw;
  }
  return null;
}

function storeTemplateId(templateId: BotIndustryTemplateId | null) {
  if (typeof window === "undefined") return;
  if (templateId) {
    sessionStorage.setItem(ONBOARDING_TEMPLATE_STORAGE_KEY, templateId);
  } else {
    sessionStorage.removeItem(ONBOARDING_TEMPLATE_STORAGE_KEY);
  }
}

function clearStoredTemplateId() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(ONBOARDING_TEMPLATE_STORAGE_KEY);
}

function readStoredWhatsAppCredentials(): WhatsAppCredentials | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(ONBOARDING_WA_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WhatsAppCredentials;
    if (parsed.phoneNumberId && parsed.whatsappBusinessAccountId) return parsed;
    return null;
  } catch {
    return null;
  }
}

function storeWhatsAppCredentials(credentials: WhatsAppCredentials) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(ONBOARDING_WA_STORAGE_KEY, JSON.stringify(credentials));
}

function clearStoredWhatsAppCredentials() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(ONBOARDING_WA_STORAGE_KEY);
}

export function OnboardingWizard() {
  const t = useT();
  const router = useRouter();
  const updateOnboarding = useUpdateOnboarding();
  const { step: resolvedStep, isLoading, whatsappStatus, primaryBot, tenant } = useOnboardingStatus();

  const [step, setStep] = useState<OnboardingStep>("whatsapp");
  const [initialized, setInitialized] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [whatsappCredentials, setWhatsappCredentials] = useState<WhatsAppCredentials | null>(null);
  const [botId, setBotId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<BotIndustryTemplateId | null>(null);

  useEffect(() => {
    if (isLoading || initialized) return;
    if (resolvedStep !== "done") {
      setStep(resolvedStep);
    } else {
      setShowDone(true);
    }
    if (primaryBot) {
      setBotId(primaryBot.botId);
    }
    if (whatsappStatus?.phoneNumberId && whatsappStatus?.whatsappBusinessAccountId) {
      setWhatsappCredentials({
        phoneNumberId: whatsappStatus.phoneNumberId,
        whatsappBusinessAccountId: whatsappStatus.whatsappBusinessAccountId,
      });
    } else {
      const stored = readStoredWhatsAppCredentials();
      if (stored) setWhatsappCredentials(stored);
    }
    const storedTemplateId = readStoredTemplateId();
    if (storedTemplateId) setTemplateId(storedTemplateId);
    setInitialized(true);
  }, [isLoading, initialized, resolvedStep, primaryBot, whatsappStatus]);

  useEffect(() => {
    if (!initialized || isLoading || !tenant) return;
    if (resolvedStep === "done" && !tenant.onboardingCompletedAt && !showDone) {
      void updateOnboarding.mutateAsync("complete").then(() => setShowDone(true));
    }
  }, [initialized, isLoading, tenant, resolvedStep, showDone, updateOnboarding]);

  const stepIndex = ONBOARDING_STEPS.indexOf(step);
  const whatsappConnected =
    Boolean(whatsappCredentials) || Boolean(whatsappStatus?.connected) || Boolean(primaryBot);

  const activeBotId = botId ?? primaryBot?.botId ?? null;
  const credentials =
    whatsappCredentials ??
    (whatsappStatus?.phoneNumberId && whatsappStatus?.whatsappBusinessAccountId
      ? {
          phoneNumberId: whatsappStatus.phoneNumberId,
          whatsappBusinessAccountId: whatsappStatus.whatsappBusinessAccountId,
        }
      : primaryBot
        ? {
            phoneNumberId: primaryBot.phoneNumberId,
            whatsappBusinessAccountId: primaryBot.whatsappBusinessAccountId,
          }
        : null);

  function canGoNext(): boolean {
    if (step === "whatsapp") return whatsappConnected;
    if (step === "create_bot") return Boolean(activeBotId);
    return false;
  }

  function nextStep() {
    const idx = ONBOARDING_STEPS.indexOf(step);
    if (idx < ONBOARDING_STEPS.length - 1) {
      setStep(ONBOARDING_STEPS[idx + 1]);
    }
  }

  function prevStep() {
    const idx = ONBOARDING_STEPS.indexOf(step);
    if (idx > 0) {
      setStep(ONBOARDING_STEPS[idx - 1]);
    }
  }

  async function handleSkip() {
    await updateOnboarding.mutateAsync("skip");
    clearStoredWhatsAppCredentials();
    clearStoredTemplateId();
    router.push("/bots");
  }

  async function handleTestConfirm() {
    await updateOnboarding.mutateAsync("testConfirmed");
    setStep("activate_flow");
  }

  async function handleFlowComplete() {
    await updateOnboarding.mutateAsync("complete");
    clearStoredWhatsAppCredentials();
    clearStoredTemplateId();
    setShowDone(true);
  }

  if (isLoading && !initialized) {
    return (
      <DashboardPage maxWidth="3xl">
        <p className="text-sm text-muted">{t("common.loading")}</p>
      </DashboardPage>
    );
  }

  if (showDone) {
    return (
      <DashboardPage maxWidth="3xl" className="space-y-6">
        <div className="rounded-xl border border-default bg-surface-elevated p-8 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-muted">
            <PartyPopper className="h-7 w-7 text-accent" />
          </div>
          <h2 className="text-xl font-semibold text-primary">{t("onboarding.done.title")}</h2>
          <p className="text-sm text-secondary">{t("onboarding.done.description")}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link href="/conversations">
              <Button>{t("onboarding.done.goToConversations")}</Button>
            </Link>
            <Link href="/bots">
              <Button variant="secondary">{t("onboarding.done.goToBots")}</Button>
            </Link>
          </div>
        </div>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage maxWidth="3xl" className="space-y-6">
      <PageHeader title={t("onboarding.title")} subtitle={t("onboarding.subtitle")} />

      <div className="flex items-center gap-2 flex-wrap">
        {ONBOARDING_STEPS.map((s, i) => (
          <Fragment key={s}>
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                s === step
                  ? "bg-accent text-white"
                  : stepIndex > i
                    ? "bg-accent-muted text-accent"
                    : "bg-surface-muted text-muted"
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-surface-elevated/20 flex items-center justify-center text-xs font-bold">
                {i + 1}
              </span>
              {t(`onboarding.step.${s === "create_bot" ? "createBot" : s === "test_message" ? "testMessage" : s === "activate_flow" ? "activateFlow" : s}`)}
            </div>
            {i < ONBOARDING_STEPS.length - 1 && (
              <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
            )}
          </Fragment>
        ))}
      </div>

      <div className="bg-surface-elevated rounded-xl border border-default p-6">
        {step === "whatsapp" && (
          <OnboardingStepWhatsApp
            connected={whatsappConnected}
            onConnected={(data) => {
              setWhatsappCredentials(data);
              storeWhatsAppCredentials(data);
            }}
          />
        )}

        {step === "create_bot" && credentials && (
          <OnboardingStepCreateBot
            phoneNumberId={credentials.phoneNumberId}
            whatsappBusinessAccountId={credentials.whatsappBusinessAccountId}
            templateId={templateId}
            onTemplateChange={(id) => {
              setTemplateId(id);
              storeTemplateId(id);
            }}
            onCreated={(id, selectedTemplateId) => {
              setBotId(id);
              setTemplateId(selectedTemplateId);
              storeTemplateId(selectedTemplateId);
              setStep("test_message");
            }}
          />
        )}

        {step === "create_bot" && !credentials && (
          <div className="space-y-4">
            <p className="text-sm text-secondary">{t("onboarding.whatsapp.description")}</p>
            <Button onClick={() => setStep("whatsapp")}>{t("onboarding.back")}</Button>
          </div>
        )}

        {step === "test_message" && activeBotId && (
          <OnboardingStepTestMessage
            botId={activeBotId}
            onConfirm={() => void handleTestConfirm()}
            confirming={updateOnboarding.isPending}
          />
        )}

        {step === "activate_flow" && activeBotId && (
          <OnboardingStepActivateFlow
            botId={activeBotId}
            templateId={templateId}
            onComplete={() => void handleFlowComplete()}
          />
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={() => void handleSkip()}
          disabled={updateOnboarding.isPending}
        >
          {t("onboarding.skip")}
        </Button>

        <div className="flex items-center gap-2">
          {stepIndex > 0 && step !== "test_message" && step !== "activate_flow" && (
            <Button variant="secondary" onClick={prevStep}>
              <ChevronLeft className="h-4 w-4" />
              {t("onboarding.back")}
            </Button>
          )}

          {(step === "whatsapp" || step === "create_bot") && (
            <Button onClick={nextStep} disabled={!canGoNext()}>
              {t("onboarding.next")}
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </DashboardPage>
  );
}
