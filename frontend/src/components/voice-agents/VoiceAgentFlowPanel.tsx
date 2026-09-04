"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Workflow } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import {
  useCreateFlow,
  useCreateTaxiVoiceFlow,
  useFlows,
  useToggleFlow,
} from "@/hooks/useFlows";
import {
  createDefaultFlowEdges,
  createDefaultFlowNodes,
} from "@/components/flows/FlowCanvas";
import { useSaveTelephonySettings, useTelephonySettings } from "@/hooks/useTelephony";
import { IntegrationErrorSupport } from "@/components/support/IntegrationErrorSupport";
import { useT } from "@/i18n/context";
import type { FlowDefinition } from "@/types";

interface VoiceAgentFlowPanelProps {
  botId: string;
}

function isVoiceFlow(flow: FlowDefinition): boolean {
  if (flow.flowKind === "voice_ai") return true;
  return flow.nodes.some(
    (node) => node.type === "trigger" && node.data.triggerType === "voice_call"
  );
}

export function VoiceAgentFlowPanel({ botId }: VoiceAgentFlowPanelProps) {
  const t = useT();
  const router = useRouter();
  const { data: flows = [], isLoading: flowsLoading } = useFlows(botId);
  const { data: settings, isLoading: settingsLoading } = useTelephonySettings(botId);
  const saveSettings = useSaveTelephonySettings(botId);
  const createFlow = useCreateFlow();
  const createTemplate = useCreateTaxiVoiceFlow();
  const toggleFlow = useToggleFlow();

  const voiceFlows = useMemo(() => flows.filter(isVoiceFlow), [flows]);
  const [selectedFlowId, setSelectedFlowId] = useState("");
  const [toggleError, setToggleError] = useState("");

  const selectedFlow = voiceFlows.find((flow) => flow.flowId === selectedFlowId);

  useEffect(() => {
    if (settings?.telephonyVoiceFlowId) {
      setSelectedFlowId(settings.telephonyVoiceFlowId);
      return;
    }
    const enabled = voiceFlows.find((flow) => flow.enabled);
    if (enabled) setSelectedFlowId(enabled.flowId);
  }, [settings?.telephonyVoiceFlowId, voiceFlows]);

  async function handleSaveSelection() {
    await saveSettings.mutateAsync({
      telephonyVoiceFlowId: selectedFlowId || "",
    });
  }

  async function handleImportTemplate() {
    const flow = await createTemplate.mutateAsync({ botId });
    setSelectedFlowId(flow.flowId);
    await saveSettings.mutateAsync({ telephonyVoiceFlowId: flow.flowId });
  }

  async function handleCreateFlow() {
    const nodes = createDefaultFlowNodes();
    const edges = createDefaultFlowEdges();
    const flow = await createFlow.mutateAsync({
      name: t("voiceAgents.flowNewDefaultName"),
      enabled: false,
      nodes,
      edges,
      entryNodeId: nodes[0]?.id ?? "",
    });
    router.push(`/flows/${flow.flowId}/edit?botId=${encodeURIComponent(botId)}`);
  }

  if (flowsLoading || settingsLoading) {
    return <div className="h-32 animate-pulse rounded-xl bg-surface-muted" />;
  }

  return (
    <div className="content-card space-y-5 p-6">
      <div className="flex items-center gap-2">
        <Workflow className="h-5 w-5 text-accent" />
        <div>
          <h2 className="text-lg font-semibold text-primary">{t("voiceAgents.flowTitle")}</h2>
          <p className="text-sm text-secondary">{t("voiceAgents.flowSubtitle")}</p>
        </div>
      </div>

      {voiceFlows.length === 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-secondary">{t("voiceAgents.flowNoVoiceFlows")}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleCreateFlow()}
              disabled={createFlow.isPending}
            >
              {t("voiceAgents.flowCreateNew")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => void handleImportTemplate()}
              disabled={createTemplate.isPending}
            >
              {t("voiceAgents.flowImportTemplate")}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div>
            <label className="mb-1 block text-xs font-medium text-secondary">
              {t("voiceAgents.flowSelectLabel")}
            </label>
            <Select
              value={selectedFlowId}
              onChange={(e) => setSelectedFlowId(e.target.value)}
            >
              <option value="">{t("voiceAgents.flowSelectPlaceholder")}</option>
              {voiceFlows.map((flow) => (
                <option key={flow.flowId} value={flow.flowId}>
                  {flow.name}
                  {flow.enabled ? ` (${t("flows.enabled")})` : ` (${t("flows.disabled")})`}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-muted">{t("voiceAgents.flowSelectHint")}</p>
          </div>

          {selectedFlow ? (
            <div className="space-y-4 rounded-lg border border-default p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-primary">{selectedFlow.name}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    selectedFlow.enabled
                      ? "bg-success/15 text-success"
                      : "bg-surface-muted text-secondary"
                  }`}
                >
                  {selectedFlow.enabled ? t("flows.enabled") : t("flows.disabled")}
                </span>
                <Link
                  href={`/flows/${selectedFlow.flowId}/edit`}
                  className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                >
                  {t("voiceAgents.flowOpenEditor")}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleSaveSelection()}
                  disabled={saveSettings.isPending}
                >
                  {t("voiceAgents.flowSaveSelection")}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setToggleError("");
                    toggleFlow.mutate(
                      {
                        flowId: selectedFlow.flowId,
                        enabled: !selectedFlow.enabled,
                      },
                      {
                        onError: (err) => setToggleError(err.message),
                      }
                    );
                  }}
                  disabled={toggleFlow.isPending}
                >
                  {selectedFlow.enabled ? t("flows.disable") : t("flows.enable")}
                </Button>
              </div>

              {toggleError ? (
                <IntegrationErrorSupport
                  integration="flow"
                  error={toggleError}
                  context={{ botId, flow: selectedFlow.name }}
                />
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-secondary">{t("voiceAgents.flowSelectHint")}</p>
          )}

          <div className="flex flex-wrap gap-2 border-t border-default pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => void handleCreateFlow()}
              disabled={createFlow.isPending}
            >
              {t("voiceAgents.flowCreateNew")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => void handleImportTemplate()}
              disabled={createTemplate.isPending}
            >
              {t("voiceAgents.flowImportTemplate")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
