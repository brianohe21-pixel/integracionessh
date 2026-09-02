"use client";

import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useT } from "@/i18n/context";
import { useFlowSecrets, useSaveFlowSecret } from "@/hooks/useFlows";
import { extractFlowSecretRefsFromNodes } from "@/lib/flow-secret-refs";
import { Button } from "@/components/ui/Button";
import type { FlowNode } from "@/types";

interface FlowSecretsPanelProps {
  flowId: string;
  isVoiceFlow: boolean;
  nodes: FlowNode[];
}

export function FlowSecretsPanel({ flowId, isVoiceFlow, nodes }: FlowSecretsPanelProps) {
  const t = useT();
  const { data: secretsData } = useFlowSecrets(flowId, isVoiceFlow);
  const saveSecret = useSaveFlowSecret(flowId);
  const [secretValues, setSecretValues] = useState<Record<string, string>>({});

  const requiredSecrets = useMemo(
    () => extractFlowSecretRefsFromNodes(nodes),
    [nodes]
  );
  const configuredSecretNames = new Set(
    (secretsData?.secrets ?? []).map((item) => item.name)
  );

  if (!isVoiceFlow) return null;

  async function handleSaveSecrets() {
    for (const [name, value] of Object.entries(secretValues)) {
      if (!value.trim()) continue;
      await saveSecret.mutateAsync({ name, value: value.trim() });
    }
    setSecretValues({});
  }

  const hasPendingValues = requiredSecrets.some((name) => secretValues[name]?.trim());

  return (
    <div className="rounded-lg border border-default bg-surface-muted/40 p-3 space-y-3">
      <div>
        <p className="text-sm font-semibold text-primary">{t("flows.secrets.title")}</p>
        <p className="text-xs text-secondary mt-1">{t("flows.secrets.subtitle")}</p>
      </div>

      {requiredSecrets.length === 0 ? (
        <p className="text-xs text-secondary">{t("flows.secrets.empty")}</p>
      ) : (
        <div className="space-y-3">
          {requiredSecrets.map((name) => (
            <div key={name}>
              <label className="mb-1 flex items-center gap-2 text-xs font-medium text-secondary">
                {name}
                {configuredSecretNames.has(name) ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                ) : null}
              </label>
              <input
                type="password"
                value={secretValues[name] ?? ""}
                onChange={(e) =>
                  setSecretValues((current) => ({
                    ...current,
                    [name]: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-field-border bg-surface-elevated p-2 text-sm shadow-sm focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
                placeholder={t("flows.secrets.placeholder")}
                autoComplete="off"
              />
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void handleSaveSecrets()}
            disabled={saveSecret.isPending || !hasPendingValues}
          >
            {t("flows.secrets.save")}
          </Button>
        </div>
      )}
    </div>
  );
}
