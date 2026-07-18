"use client";

import { useMemo, useState } from "react";
import { useT } from "@/i18n/context";
import { Tabs } from "@/components/ui/Tabs";
import { MetaFlowJsonEditor } from "@/components/meta-flows/MetaFlowJsonEditor";
import { MetaFlowVisualEditor } from "@/components/meta-flows/MetaFlowVisualEditor";
import {
  applyVisualToMetaFlowJson,
  createEmptyVisualFlow,
  parseMetaFlowJsonToVisual,
  type VisualMetaFlow,
} from "@/lib/meta-flow-editor";

type EditorTab = "visual" | "json";

interface MetaFlowEditorPanelProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

export function MetaFlowEditorPanel({ value, onChange, readOnly }: MetaFlowEditorPanelProps) {
  const t = useT();
  const [tab, setTab] = useState<EditorTab>("visual");

  const visual = useMemo(() => {
    try {
      return parseMetaFlowJsonToVisual(JSON.parse(value) as Record<string, unknown>);
    } catch {
      return null;
    }
  }, [value]);

  function syncJsonFromVisual(nextVisual: VisualMetaFlow) {
    try {
      const current = JSON.parse(value) as Record<string, unknown>;
      const updated = applyVisualToMetaFlowJson(current, nextVisual);
      onChange(JSON.stringify(updated, null, 2));
    } catch {
      const updated = applyVisualToMetaFlowJson(
        { version: "7.3", screens: [] },
        nextVisual
      );
      onChange(JSON.stringify(updated, null, 2));
    }
  }

  const tabs = [
    { id: "visual" as const, label: t("metaFlows.tabVisual") },
    { id: "json" as const, label: t("metaFlows.tabJson") },
  ];

  return (
    <div className="space-y-3">
      <Tabs items={tabs} value={tab} onChange={setTab} />

      {tab === "visual" ? (
        visual ? (
          <MetaFlowVisualEditor
            value={visual}
            onChange={syncJsonFromVisual}
            readOnly={readOnly}
          />
        ) : (
          <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
            <p>{t("metaFlows.visualUnsupported")}</p>
            {!readOnly && (
              <button
                type="button"
                onClick={() => syncJsonFromVisual(createEmptyVisualFlow())}
                className="mt-3 text-xs font-medium underline"
              >
                {t("metaFlows.resetVisual")}
              </button>
            )}
          </div>
        )
      ) : (
        <MetaFlowJsonEditor value={value} onChange={onChange} readOnly={readOnly} />
      )}
    </div>
  );
}
