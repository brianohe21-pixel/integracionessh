export type OnboardingStep =
  | "whatsapp"
  | "create_bot"
  | "test_message"
  | "activate_flow"
  | "done";

export const ONBOARDING_STEPS: OnboardingStep[] = [
  "whatsapp",
  "create_bot",
  "test_message",
  "activate_flow",
];

export function resolveOnboardingStep(params: {
  onboardingCompletedAt?: string;
  onboardingTestConfirmedAt?: string;
  whatsappConnected: boolean;
  hasBot: boolean;
  hasEnabledFlow: boolean;
}): OnboardingStep {
  if (params.onboardingCompletedAt) return "done";
  if (!params.whatsappConnected && !params.hasBot) return "whatsapp";
  if (!params.hasBot) return "create_bot";
  if (!params.onboardingTestConfirmedAt) return "test_message";
  if (!params.hasEnabledFlow) return "activate_flow";
  return "done";
}

export function onboardingStepIndex(step: OnboardingStep): number {
  const idx = ONBOARDING_STEPS.indexOf(step);
  return idx === -1 ? ONBOARDING_STEPS.length : idx + 1;
}

export function whatsAppMeLink(displayPhone: string): string {
  const digits = displayPhone.replace(/\D/g, "");
  return `https://wa.me/${digits}`;
}

export type ChecklistItemStatus = "complete" | "current" | "pending";

export interface ChecklistItem {
  step: OnboardingStep;
  labelKey: string;
  descriptionKey: string;
  href: string;
  status: ChecklistItemStatus;
}

const CHECKLIST_META: Record<
  Exclude<OnboardingStep, "done">,
  { labelKey: string; descriptionKey: string }
> = {
  whatsapp: {
    labelKey: "onboarding.step.whatsapp",
    descriptionKey: "helpCenter.checklist.whatsappDescription",
  },
  create_bot: {
    labelKey: "onboarding.step.createBot",
    descriptionKey: "helpCenter.checklist.createBotDescription",
  },
  test_message: {
    labelKey: "onboarding.step.testMessage",
    descriptionKey: "helpCenter.checklist.testMessageDescription",
  },
  activate_flow: {
    labelKey: "onboarding.step.activateFlow",
    descriptionKey: "helpCenter.checklist.activateFlowDescription",
  },
};

function isStepComplete(
  step: Exclude<OnboardingStep, "done">,
  params: {
    onboardingTestConfirmedAt?: string;
    whatsappConnected: boolean;
    hasBot: boolean;
    hasEnabledFlow: boolean;
  }
): boolean {
  switch (step) {
    case "whatsapp":
      return params.whatsappConnected;
    case "create_bot":
      return params.hasBot;
    case "test_message":
      return Boolean(params.onboardingTestConfirmedAt);
    case "activate_flow":
      return params.hasEnabledFlow;
  }
}

export function getChecklistItems(params: {
  onboardingCompletedAt?: string;
  onboardingTestConfirmedAt?: string;
  whatsappConnected: boolean;
  hasBot: boolean;
  hasEnabledFlow: boolean;
}): ChecklistItem[] {
  const currentStep = resolveOnboardingStep(params);

  return ONBOARDING_STEPS.map((step) => {
    const checklistStep = step as Exclude<OnboardingStep, "done">;
    const complete =
      Boolean(params.onboardingCompletedAt) || isStepComplete(checklistStep, params);
    const status: ChecklistItemStatus = complete
      ? "complete"
      : currentStep === step
        ? "current"
        : "pending";

    return {
      step,
      labelKey: CHECKLIST_META[checklistStep].labelKey,
      descriptionKey: CHECKLIST_META[checklistStep].descriptionKey,
      href: "/onboarding",
      status,
    };
  });
}

export function getPendingChecklistCount(params: {
  onboardingCompletedAt?: string;
  onboardingTestConfirmedAt?: string;
  whatsappConnected: boolean;
  hasBot: boolean;
  hasEnabledFlow: boolean;
}): number {
  if (params.onboardingCompletedAt) return 0;
  return getChecklistItems(params).filter((item) => item.status !== "complete").length;
}
