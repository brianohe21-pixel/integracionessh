"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { useT } from "@/i18n/context";
import { useFlow, useUpdateFlow } from "@/hooks/useFlows";
import type { FlowEdge, FlowNode, FlowNodeType } from "@/types";
import { NodePalette } from "@/components/flows/NodePalette";
import { NodePropertiesPanel } from "@/components/flows/NodePropertiesPanel";
import { FlowEditorToolbar } from "@/components/flows/FlowEditorToolbar";

const FlowCanvas = dynamic(
  () => import("@/components/flows/FlowCanvas").then((m) => m.FlowCanvas),
  { ssr: false, loading: () => <div className="h-[520px] animate-pulse rounded-xl bg-surface-muted" /> }
);

export default function EditFlowPage() {
  const t = useT();
  const { flowId } = useParams<{ flowId: string }>();
  const { data: flow, isLoading } = useFlow(flowId);
  const update = useUpdateFlow(flowId);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [localNodes, setLocalNodes] = useState<FlowNode[]>([]);
  const [localEdges, setLocalEdges] = useState<FlowEdge[]>([]);
  const [triggerWarning, setTriggerWarning] = useState(false);

  useEffect(() => {
    if (flow) {
      setLocalNodes(flow.nodes);
      setLocalEdges(flow.edges);
    }
  }, [flow]);

  const selected = localNodes.find((n) => n.id === selectedNodeId);
  const triggerCount = localNodes.filter((n) => n.type === "trigger").length;
  const canDeleteSelected =
    !!selected && !(selected.type === "trigger" && triggerCount <= 1);

  const getTypeLabel = useCallback(
    (type: FlowNodeType) => t(`flows.nodeTypes.${type}`),
    [t]
  );

  const getBranchLabel = useCallback(
    (key: "true" | "false") => t(`flows.fields.branch${key === "true" ? "True" : "False"}`),
    [t]
  );

  function handleCanvasChange(nodes: FlowNode[], edges: FlowEdge[]) {
    setLocalNodes(nodes);
    setLocalEdges(edges);
  }

  function updateSelectedData(patch: Record<string, unknown>) {
    if (!selectedNodeId) return;
    setLocalNodes((nodes) =>
      nodes.map((n) =>
        n.id === selectedNodeId ? { ...n, data: { ...n.data, ...patch } } : n
      )
    );
  }

  function addNode(type: FlowNodeType) {
    const id = `${type}-${Date.now()}`;
    const defaultData: Record<string, unknown> = { label: t(`flows.nodeTypes.${type}`) };
    if (type === "message") defaultData.messageText = "";
    if (type === "buttons") {
      defaultData.messageText = t("flows.fields.defaultButtonPrompt");
      defaultData.buttons = [{ id: "btn-1", title: "" }];
    }
    if (type === "delay") defaultData.delaySeconds = 5;
    if (type === "condition") {
      defaultData.conditionVariable = "last_input";
      defaultData.conditionOperator = "contains";
    }
    setLocalNodes((nodes) => [
      ...nodes,
      {
        id,
        type,
        position: { x: 220 + (nodes.length % 3) * 48, y: 60 + Math.floor(nodes.length / 3) * 150 },
        data: defaultData,
      },
    ]);
    setSelectedNodeId(id);
  }

  function deleteSelectedNode() {
    if (!selectedNodeId || !canDeleteSelected) return;
    setLocalNodes((nodes) => nodes.filter((n) => n.id !== selectedNodeId));
    setLocalEdges((edges) =>
      edges.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId)
    );
    setSelectedNodeId(null);
  }

  function handleCannotDeleteTrigger() {
    setTriggerWarning(true);
    setTimeout(() => setTriggerWarning(false), 3000);
  }

  async function handleSave() {
    if (!flow) return;
    await update.mutateAsync({
      name: flow.name,
      nodes: localNodes,
      edges: localEdges,
      entryNodeId: localNodes.find((n) => n.type === "trigger")?.id ?? flow.entryNodeId,
    });
  }

  if (isLoading || !flow) {
    return (
      <div className="h-64 animate-pulse bg-surface-muted" />
    );
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] w-full max-w-full flex-col overflow-hidden lg:h-full">
      <FlowEditorToolbar
        flowName={flow.name}
        isPublished={flow.enabled}
        isSaving={update.isPending}
        onSave={() => void handleSave()}
      />

      {triggerWarning && (
        <p className="border-b border-warning/30 bg-warning/10 px-4 py-2 text-sm text-warning">
          {t("flows.cannotDeleteTrigger")}
        </p>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <aside className="hidden w-44 flex-shrink-0 overflow-y-auto border-r border-default bg-surface-elevated p-3 lg:block xl:w-48">
          <NodePalette onAddNode={addNode} />
        </aside>

        <div className="min-h-0 min-w-0 flex-1">
          <FlowCanvas
            flow={{
              ...flow,
              nodes: localNodes.length > 0 ? localNodes : flow.nodes,
              edges: localEdges,
            }}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            onChange={handleCanvasChange}
            getTypeLabel={getTypeLabel}
            getBranchLabel={getBranchLabel}
            onCannotDeleteTrigger={handleCannotDeleteTrigger}
          />
        </div>

        <aside className="hidden w-60 flex-shrink-0 overflow-y-auto border-l border-default bg-surface-elevated p-3 lg:block xl:w-64">
          <NodePropertiesPanel
            selected={selected}
            botId={flow.botId}
            onUpdate={updateSelectedData}
            onDelete={deleteSelectedNode}
            canDelete={canDeleteSelected}
          />
        </aside>
      </div>
    </div>
  );
}
