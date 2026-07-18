"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useBots } from "@/hooks/useBots";
import { useFlows } from "@/hooks/useFlows";
import {
  onboardingStepIndex,
  resolveOnboardingStep,
  type OnboardingStep,
} from "@/lib/onboarding";
import type { Tenant } from "@/types";

export interface WhatsAppStatus {
  connected: boolean;
  phoneNumberId?: string;
  whatsappBusinessAccountId?: string;
}

export type OnboardingAction = "skip" | "testConfirmed" | "complete";

export function useOnboardingStatus() {
  const { data: tenant, isLoading: tenantLoading } = useQuery({
    queryKey: ["tenant"],
    queryFn: () => api.get<Tenant>("/tenants/me"),
  });

  const { data: bots = [], isLoading: botsLoading } = useBots();

  const { data: whatsappStatus, isLoading: waLoading } = useQuery({
    queryKey: ["whatsapp", "status"],
    queryFn: () => api.get<WhatsAppStatus>("/whatsapp/status"),
  });

  const primaryBot = bots[0];
  const { data: flows = [], isLoading: flowsLoading } = useFlows(primaryBot?.botId);
  const hasEnabledFlow = flows.some((flow) => flow.enabled);

  const step = resolveOnboardingStep({
    onboardingCompletedAt: tenant?.onboardingCompletedAt,
    onboardingTestConfirmedAt: tenant?.onboardingTestConfirmedAt,
    whatsappConnected: whatsappStatus?.connected ?? false,
    hasBot: bots.length > 0,
    hasEnabledFlow,
  });

  const showBanner = Boolean(
    tenant?.onboardingSkippedAt && !tenant?.onboardingCompletedAt
  );

  const isComplete = step === "done" && Boolean(tenant?.onboardingCompletedAt);

  return {
    tenant,
    bots,
    primaryBot,
    whatsappStatus,
    flows,
    step,
    stepNumber: onboardingStepIndex(step),
    showBanner,
    isComplete,
    isLoading: tenantLoading || botsLoading || waLoading || flowsLoading,
  };
}

export function useUpdateOnboarding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (action: OnboardingAction) => {
      const body =
        action === "skip"
          ? { skip: true }
          : action === "testConfirmed"
            ? { testConfirmed: true }
            : { complete: true };
      return api.patch<Tenant>("/tenants/me/onboarding", body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tenant"] });
    },
  });
}

export type { OnboardingStep };
