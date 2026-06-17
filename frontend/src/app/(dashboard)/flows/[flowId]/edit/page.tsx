"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { useT } from "@/i18n/context";
import { useFlow, useUpdateFlow } from "@/hooks/useFlows";
import type { FlowEdge, FlowNode, FlowNodeType } from "@/types";
import { DashboardPage } from "@/components/layout/DashboardPage";

const FlowCanvas = dynamic(
  () => import("@/components/flows/FlowCanvas").then((m) => m.FlowCanvas),
  { ssr: false, loading: () => <div className="h-[520px] bg-gray-100 rounded-xl animate-pulse" /> }
);

const NODE_TYPES: FlowNodeType[] = [
  "message",
  "condition",
  "buttons",
  "meta_flow",
  "handoff",
  "delay",
  "set_variable",
  "end",
];

export default function EditFlowPage() {
  const t = useT();
  const { flowId } = useParams<{ flowId: string }>();
  const { data: flow, isLoading } = useFlow(flowId);
  const update = useUpdateFlow(flowId);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [localNodes, setLocalNodes] = useState<FlowNode[]>([]);
  const [localEdges, setLocalEdges] = useState<FlowEdge[]>([]);

  useEffect(() => {
    if (flow) {
      setLocalNodes(flow.nodes);
      setLocalEdges(flow.edges);
    }
  }, [flow]);

  const selected = localNodes.find((n) => n.id === selectedNodeId);

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
    setLocalNodes((nodes) => [
      ...nodes,
      {
        id,
        type,
        position: { x: 120 + nodes.length * 40, y: 200 },
        data: { label: type },
      },
    ]);
    setSelectedNodeId(id);
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
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg"
        >
          {t("flows.save")}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
          <FlowCanvas
            key={flow.flowId}
            flow={{
              ...flow,
              nodes: localNodes.length > 0 ? localNodes : flow.nodes,
              edges: localEdges.length > 0 ? localEdges : flow.edges,
            }}
            onChange={handleCanvasChange}
          />
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-900">{t("flows.addNode")}</p>
          <div className="flex flex-wrap gap-1">
            {NODE_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => addNode(type)}
                className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50"
              >
                {type}
              </button>
            ))}
          </div>

          <p className="text-sm font-semibold text-gray-900 pt-2">{t("flows.nodePanel")}</p>
          <select
            value={selectedNodeId ?? ""}
            onChange={(e) => setSelectedNodeId(e.target.value || null)}
            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
          >
            <option value="">—</option>
            {localNodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.type} ({n.id})
              </option>
            ))}
          </select>

          {selected?.type === "message" && (
            <textarea
              value={selected.data.messageText ?? ""}
              onChange={(e) => updateSelectedData({ messageText: e.target.value })}
              rows={4}
              className="w-full text-sm border border-gray-300 rounded-lg p-2"
            />
          )}
          {selected?.type === "trigger" && (
            <select
              value={selected.data.triggerType ?? "any_message"}
              onChange={(e) =>
                updateSelectedData({ triggerType: e.target.value })
              }
              className="w-full text-sm border border-gray-300 rounded-lg p-2 bg-white"
            >
              <option value="any_message">any_message</option>
              <option value="first_message">first_message</option>
              <option value="keyword">keyword</option>
            </select>
          )}
          {selected?.type === "delay" && (
            <input
              type="number"
              min={1}
              value={selected.data.delaySeconds ?? 5}
              onChange={(e) => updateSelectedData({ delaySeconds: Number(e.target.value) })}
              className="w-full text-sm border border-gray-300 rounded-lg p-2"
            />
          )}
        </div>
      </div>
    </DashboardPage>
  );
}
