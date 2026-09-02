"use client";

import dynamic from "next/dynamic";
import { useParams, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import { useT } from "@/i18n/context";
import { useFlow, useToggleFlow, useUpdateFlow } from "@/hooks/useFlows";
import { useFullscreen } from "@/hooks/useFullscreen";
import { useFlowEditorHistory } from "@/hooks/useFlowEditorHistory";
import { useResizablePanel } from "@/hooks/useResizablePanel";
import type { FlowEdge, FlowNode, FlowNodeType } from "@/types";
import { NodePalette } from "@/components/flows/NodePalette";
import { NodePropertiesModal } from "@/components/flows/NodePropertiesModal";
import { FlowEditorToolbar } from "@/components/flows/FlowEditorToolbar";
import { FlowSecretsPanel } from "@/components/flows/FlowSecretsPanel";
import { FlowRunsPanel } from "@/components/flows/FlowRunsPanel";
import { FlowPreviewModal } from "@/components/flows/FlowPreviewModal";
import { resolveFlowBotIdFromNodes } from "@/lib/resolve-flow-bot";
import { createFlowNode, defaultPalettePosition } from "@/lib/flow-node-factory";
import { isWebhookReceivingFlow } from "@/lib/flow-webhook";
import { applyResolvedTriggerType, resolveFlowSamplePayload } from "@/lib/resolve-flow-trigger";

const FlowCanvas = dynamic(
  () => import("@/components/flows/FlowCanvas").then((m) => m.FlowCanvas),
  { ssr: false, loading: () => <div className="h-[520px] animate-pulse rounded-xl bg-surface-muted" /> }
);

function flowSnapshotKey(nodes: FlowNode[], edges: FlowEdge[]): string {
  return JSON.stringify({ nodes, edges });
}

export default function EditFlowPage() {
  const t = useT();
  const { flowId } = useParams<{ flowId: string }>();
  const searchParams = useSearchParams();
  const suggestedBotId = searchParams.get("botId") ?? "";
  const { data: flow, isLoading } = useFlow(flowId);
  const update = useUpdateFlow(flowId);
  const toggleFlow = useToggleFlow();
  const editorRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(editorRef);
  const palettePanel = useResizablePanel({
    defaultWidth: 280,
    minWidth: 176,
    maxWidth: 480,
    storageKey: "flow-editor-palette-width",
  });
  const {
    nodes: localNodes,
    edges: localEdges,
    canUndo,
    canRedo,
    reset: resetHistory,
    commit: commitHistory,
    undo,
    redo,
  } = useFlowEditorHistory();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [triggerWarning, setTriggerWarning] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [savedMessage, setSavedMessage] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedKey, setSavedKey] = useState("");
  const initializedFlowKeyRef = useRef<string | null>(null);
  const handleSaveRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    if (!flow) return;
    const key = `${flow.flowId}:${flow.version}`;
    if (initializedFlowKeyRef.current === key) return;
    initializedFlowKeyRef.current = key;
    resetHistory({ nodes: flow.nodes, edges: flow.edges });
    setSavedKey(flowSnapshotKey(flow.nodes, flow.edges));
    setSavedMessage(false);
    setSaveError("");
  }, [flow, resetHistory]);

  useEffect(() => {
    if (selectedNodeId && !localNodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(null);
    }
  }, [localNodes, selectedNodeId]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const modifier = event.metaKey || event.ctrlKey;

      if (modifier && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void handleSaveRef.current();
        return;
      }

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (!modifier) return;

      if (event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }

      if (event.key.toLowerCase() === "z" && event.shiftKey) {
        event.preventDefault();
        redo();
        return;
      }

      if (event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  useEffect(() => {
    window.dispatchEvent(new Event("resize"));
  }, [isFullscreen, palettePanel.width]);

  const selected = localNodes.find((n) => n.id === selectedNodeId);
  const triggerNode = localNodes.find((n) => n.type === "trigger");
  const isFormFlow = isWebhookReceivingFlow(localNodes);
  const hasWebhookNode = localNodes.some((node) => node.type === "webhook");
  const isVoiceFlow =
    flow?.flowKind === "voice_ai" || triggerNode?.data.triggerType === "voice_call";
  const isMessagingFlow = !isVoiceFlow && !hasWebhookNode;
  const samplePayload = resolveFlowSamplePayload(localNodes);
  const assignedBotId =
    resolveFlowBotIdFromNodes(localNodes) || flow?.botId || suggestedBotId;
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
    commitHistory({ nodes, edges }, { debounce: true });
  }

  function updateSelectedData(patch: Record<string, unknown>) {
    if (!selectedNodeId) return;
    const nodes = localNodes.map((node) =>
      node.id === selectedNodeId ? { ...node, data: { ...node.data, ...patch } } : node
    );
    commitHistory({ nodes, edges: localEdges }, { debounce: true });
  }

  function addNode(type: FlowNodeType, position?: { x: number; y: number }) {
    const node = createFlowNode({
      type,
      position: position ?? defaultPalettePosition(localNodes.length),
      label: t(`flows.nodeTypes.${type}`),
      suggestedBotId,
    });
    if (type === "buttons") {
      node.data.messageText = t("flows.fields.defaultButtonPrompt");
    }
    const nodes = [...localNodes, node];
    commitHistory({ nodes, edges: localEdges });
    setSelectedNodeId(node.id);
  }

  function deleteSelectedNode() {
    if (!selectedNodeId || !canDeleteSelected) return;
    const nodes = localNodes.filter((node) => node.id !== selectedNodeId);
    const edges = localEdges.filter(
      (edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId
    );
    commitHistory({ nodes, edges });
    setSelectedNodeId(null);
  }

  function handleCannotDeleteTrigger() {
    setTriggerWarning(true);
    setTimeout(() => setTriggerWarning(false), 3000);
  }

  async function handleSave() {
    if (!flow || update.isPending) return;
    const nodesToSave = localNodes.length > 0 ? localNodes : flow.nodes;
    const edgesToSave = localNodes.length > 0 ? localEdges : flow.edges;
    if (flowSnapshotKey(nodesToSave, edgesToSave) === savedKey) return;
    const nodes = applyResolvedTriggerType(nodesToSave, isVoiceFlow);
    setSaveError("");
    setSavedMessage(false);
    try {
      await update.mutateAsync({
        name: flow.name,
        nodes,
        edges: edgesToSave,
        entryNodeId: nodes.find((n) => n.type === "trigger")?.id ?? flow.entryNodeId,
      });
      setSavedKey(flowSnapshotKey(nodesToSave, edgesToSave));
      setSavedMessage(true);
      window.setTimeout(() => setSavedMessage(false), 2500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t("flows.unsaved"));
    }
  }

  handleSaveRef.current = handleSave;

  const isDirty = flowSnapshotKey(localNodes, localEdges) !== savedKey && localNodes.length > 0;

  useEffect(() => {
    if (!isDirty || !flow || update.isPending) return;

    const timer = window.setTimeout(() => {
      void handleSaveRef.current();
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [isDirty, localNodes, localEdges, flow, update.isPending]);

  if (isLoading || !flow) {
    return (
      <div className="h-64 animate-pulse bg-surface-muted" />
    );
  }

  return (
    <div
      ref={editorRef}
      className="flex h-[calc(100dvh-3.5rem)] w-full max-w-full flex-col overflow-hidden bg-canvas lg:h-full"
    >
      <FlowEditorToolbar
        flowName={flow.name}
        isPublished={flow.enabled}
        isSaving={update.isPending}
        isToggling={toggleFlow.isPending}
        isDirty={isDirty}
        justSaved={savedMessage}
        onSave={() => void handleSave()}
        onToggleEnabled={() =>
          void toggleFlow.mutateAsync({ flowId: flow.flowId, enabled: !flow.enabled })
        }
        onPreview={() => setPreviewOpen(true)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => void toggleFullscreen()}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
      />

      {previewOpen ? (
        <FlowPreviewModal
          nodes={localNodes}
          edges={localEdges}
          getTypeLabel={getTypeLabel}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}

      {saveError ? (
        <p className="border-b border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">
          {saveError}
        </p>
      ) : null}

      {toggleFlow.isError && (
        <p className="border-b border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">
          {toggleFlow.error.message}
        </p>
      )}

      {triggerWarning && (
        <p className="border-b border-warning/30 bg-warning/10 px-4 py-2 text-sm text-warning">
          {t("flows.cannotDeleteTrigger")}
        </p>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <aside
          ref={palettePanel.panelRef}
          style={{ width: palettePanel.width }}
          className="relative hidden flex-shrink-0 overflow-x-hidden overflow-y-auto border-r border-default bg-surface-elevated p-3 lg:block"
        >
          <NodePalette onAddNode={addNode} />
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={t("flows.resizePalette")}
            onMouseDown={palettePanel.startResize}
            className={`absolute right-0 top-0 z-10 h-full w-1 cursor-col-resize touch-none transition-colors hover:bg-accent/30 ${
              palettePanel.isResizing ? "bg-accent/40" : ""
            }`}
          />
        </aside>

        <div className="min-h-0 min-w-0 flex-1">
          <FlowCanvas
            flow={{
              ...flow,
              nodes: localNodes.length > 0 ? localNodes : flow.nodes,
              edges: localEdges.length > 0 ? localEdges : flow.edges,
            }}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            onChange={handleCanvasChange}
            onAddNode={addNode}
            getTypeLabel={getTypeLabel}
            getBranchLabel={getBranchLabel}
            onCannotDeleteTrigger={handleCannotDeleteTrigger}
          />
        </div>

        <aside className="hidden w-60 flex-shrink-0 overflow-y-auto border-l border-default bg-surface-elevated p-3 lg:block xl:w-64 space-y-4">
          <FlowSecretsPanel
            flowId={flow.flowId}
            isVoiceFlow={isVoiceFlow}
            nodes={localNodes.length > 0 ? localNodes : flow.nodes}
          />
          <FlowRunsPanel flowId={flow.flowId} isFormFlow={isFormFlow} />
        </aside>
      </div>

      <NodePropertiesModal
        selected={selected}
        flowId={flow.flowId}
        hasWebhookNode={hasWebhookNode}
        isMessagingFlow={isMessagingFlow}
        botId={assignedBotId}
        isVoiceFlow={isVoiceFlow}
        samplePayload={samplePayload}
        onUpdate={updateSelectedData}
        onDelete={deleteSelectedNode}
        canDelete={canDeleteSelected}
        onClose={() => setSelectedNodeId(null)}
      />
    </div>
  );
}
