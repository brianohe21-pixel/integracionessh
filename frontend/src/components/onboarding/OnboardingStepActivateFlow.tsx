"use client";

import { useState } from "react";
import { useLocale, useT } from "@/i18n/context";
import { useCreateFlow, useToggleFlow } from "@/hooks/useFlows";
import {
  createDefaultFlowEdges,
  createDefaultFlowNodes,
} from "@/components/flows/FlowCanvas";
import { getBotTemplate } from "@/lib/bot-templates";
import type { BotIndustryTemplateId } from "@/lib/bot-templates";
import { Button } from "@/components/ui/Button";
import { ArrowRight, MessageSquare, Zap } from "lucide-react";
import type { FlowNode } from "@/types";

interface OnboardingStepActivateFlowProps {
  botId: string;
  templateId: BotIndustryTemplateId | null;
  onComplete: () => void;
}

function createWelcomeFlowNodes(messageText: string): FlowNode[] {
  return createDefaultFlowNodes().map((node) =>
    node.id === "message-1"
      ? { ...node, data: { ...node.data, messageText } }
      : node
  );
}

export function OnboardingStepActivateFlow({
  botId,
  templateId,
  onComplete,
}: OnboardingStepActivateFlowProps) {
  const t = useT();
  const locale = useLocale();
  const createFlow = useCreateFlow();
  const toggleFlow = useToggleFlow();
  const [error, setError] = useState("");
  const [activating, setActivating] = useState(false);

  const templateFlow = templateId ? getBotTemplate(templateId).getFlowDefinition(locale) : null;
  const welcomeMessage =
    templateFlow?.welcomeMessage ?? t("onboarding.activateFlow.previewMessage");
  const previewTrigger = templateFlow
    ? t("onboarding.activateFlow.previewTriggerFirstMessage")
    : t("onboarding.activateFlow.previewTrigger");

  async function handleActivate() {
    setError("");
    setActivating(true);

    try {
      const flowDefinition = templateFlow ?? {
        name: t("onboarding.step.activateFlow"),
        nodes: createWelcomeFlowNodes(welcomeMessage),
        edges: createDefaultFlowEdges(),
        entryNodeId: "trigger-1",
      };

      const flow = await createFlow.mutateAsync({
        name: flowDefinition.name,
        botId,
        enabled: false,
        nodes: flowDefinition.nodes,
        edges: flowDefinition.edges,
        entryNodeId: flowDefinition.entryNodeId,
      });
      await toggleFlow.mutateAsync({ flowId: flow.flowId, enabled: true });
      onComplete();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActivating(false);
    }
  }

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-primary">{t("onboarding.activateFlow.title")}</h2>
        <p className="mt-1 text-sm text-secondary">{t("onboarding.activateFlow.description")}</p>
      </header>

      <div className="space-y-3 rounded-xl border border-default p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-muted">
            <Zap className="h-4 w-4 text-accent" />
          </span>
          <p className="text-sm font-medium text-primary">{previewTrigger}</p>
        </div>
        <div className="flex justify-center text-muted">
          <ArrowRight className="h-4 w-4 rotate-90" />
        </div>
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-muted">
            <MessageSquare className="h-4 w-4 text-accent" />
          </span>
          <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-primary">
            {welcomeMessage}
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button
        onClick={() => void handleActivate()}
        disabled={activating || createFlow.isPending || toggleFlow.isPending}
        className="w-full"
      >
        {activating ? t("onboarding.activateFlow.activating") : t("onboarding.activateFlow.activate")}
      </Button>
    </section>
  );
}
