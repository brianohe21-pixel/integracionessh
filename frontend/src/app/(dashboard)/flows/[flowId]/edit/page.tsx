"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { useT } from "@/i18n/context";
import { useFlow, useUpdateFlow } from "@/hooks/useFlows";
import type { FlowEdge, FlowNode, FlowNodeType } from "@/types";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { NodePalette } from "@/components/flows/NodePalette";
import { NodePropertiesPanel } from "@/components/flows/NodePropertiesPanel";

const FlowCanvas = dynamic(
  () => import("@/components/flows/FlowCanvas").then((m) => m.FlowCanvas),
  { ssr: false, loading: () => <div className="h-[520px] bg-gray-100 rounded-xl animate-pulse" /> }
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
        position: { x: 120 + (nodes.length % 5) * 48, y: 80 + Math.floor(nodes.length / 5) * 100 },
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
      <DashboardPage>
        <div className="h-64 animate-pulse bg-gray-100 rounded-xl" />
      </DashboardPage>
    );
  }

  return (
    <DashboardPage>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">{flow.name}</h1>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={update.isPending}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {t("flows.save")}
        </button>
      </div>

      {triggerWarning && (
        <p className="mb-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {t("flows.cannotDeleteTrigger")}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
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
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4 max-h-[calc(100vh-12rem)] overflow-y-auto">
          <NodePalette onAddNode={addNode} />
          <hr className="border-gray-100" />
          <NodePropertiesPanel
            selected={selected}
            botId={flow.botId}
            onUpdate={updateSelectedData}
            onDelete={deleteSelectedNode}
            canDelete={canDeleteSelected}
          />
        </div>
      </div>
    </DashboardPage>
  );
}
