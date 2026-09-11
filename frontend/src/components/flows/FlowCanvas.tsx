"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Connection,
  type Node,
  type Edge,
  type NodeChange,
  type NodeTypes,
  type EdgeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { FlowDefinition, FlowEdge, FlowNode, FlowNodeType } from "@/types";
import { FlowNodeCard } from "./FlowNodeCard";
import { FlowDeletableEdge } from "./FlowDeletableEdge";
import { FlowNodeActionsContext } from "./FlowNodeActionsContext";
import { buildNodePreview } from "./nodeConfig";
import { FLOW_NODE_DRAG_MIME } from "@/lib/flow-node-factory";
import { useLocale } from "@/i18n/context";

const nodeTypes: NodeTypes = {
  flowNode: FlowNodeCard,
};

const edgeTypes: EdgeTypes = {
  default: FlowDeletableEdge,
};

function formatCoord(value: number): string {
  return String(Math.round(value));
}

function fingerprint(nodes: FlowNode[], edges: FlowEdge[]): string {
  const nodePart = nodes
    .map(
      (n) =>
        `${n.id}:${n.type}:${formatCoord(n.position.x)},${formatCoord(n.position.y)}:${JSON.stringify(n.data)}`
    )
    .join("|");
  const edgePart = edges
    .map((e) => `${e.id}:${e.source}:${e.target}:${e.sourceHandle ?? ""}`)
    .join("|");
  return `${nodePart}::${edgePart}`;
}

function toReactFlowNodes(
  nodes: FlowNode[],
  selectedNodeId: string | null,
  getTypeLabel: (type: FlowNodeType) => string,
  getBranchLabel: (key: "true" | "false") => string,
  locale: "es" | "en"
): Node[] {
  return nodes.map((n) => ({
    id: n.id,
    type: "flowNode",
    position: n.position,
    selected: n.id === selectedNodeId,
    data: {
      flowType: n.type,
      typeLabel: getTypeLabel(n.type),
      preview: buildNodePreview(n.type, n.data, locale),
      buttons: n.data.buttons,
      trueLabel: getBranchLabel("true"),
      falseLabel: getBranchLabel("false"),
    },
  }));
}

function toReactFlowEdges(edges: FlowEdge[], nodes: FlowNode[]): Edge[] {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const nodeTypeById = new Map(nodes.map((n) => [n.id, n.type]));
  return edges
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .map((e) => {
    const sourceType = nodeTypeById.get(e.source);
    const isHumanEdge = sourceType === "handoff";
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      deletable: true,
      selectable: true,
      style: isHumanEdge
        ? { stroke: "var(--human)", strokeDasharray: "6 4" }
        : { stroke: "var(--accent)" },
      className: isHumanEdge ? "human-edge" : undefined,
    };
  });
}

function fromReactFlow(
  nodes: Node[],
  edges: Edge[],
  original: FlowDefinition
): Pick<FlowDefinition, "nodes" | "edges"> {
  const flowNodes: FlowNode[] = nodes.map((n) => {
    const existing = original.nodes.find((x) => x.id === n.id);
    return {
      id: n.id,
      type: (existing?.type ?? "message") as FlowNodeType,
      position: n.position,
      data: existing?.data ?? { label: "" },
    };
  });
  const flowEdges: FlowEdge[] = edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? undefined,
  }));
  return { nodes: flowNodes, edges: flowEdges };
}

interface FlowCanvasProps {
  flow: FlowDefinition;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onChange: (nodes: FlowNode[], edges: FlowEdge[]) => void;
  onAddNode: (type: FlowNodeType, position: { x: number; y: number }) => void;
  getTypeLabel: (type: FlowNodeType) => string;
  getBranchLabel: (key: "true" | "false") => string;
  onCannotDeleteTrigger?: () => void;
}

function FlowCanvasInner({
  flow,
  selectedNodeId,
  onSelectNode,
  onChange,
  onAddNode,
  getTypeLabel,
  getBranchLabel,
  onCannotDeleteTrigger,
}: FlowCanvasProps) {
  const locale = useLocale();
  const flowRef = useRef(flow);
  flowRef.current = flow;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onAddNodeRef = useRef(onAddNode);
  onAddNodeRef.current = onAddNode;
  const onSelectNodeRef = useRef(onSelectNode);
  onSelectNodeRef.current = onSelectNode;
  const onCannotDeleteTriggerRef = useRef(onCannotDeleteTrigger);
  onCannotDeleteTriggerRef.current = onCannotDeleteTrigger;
  const selectedNodeIdRef = useRef(selectedNodeId);
  selectedNodeIdRef.current = selectedNodeId;
  const getTypeLabelRef = useRef(getTypeLabel);
  getTypeLabelRef.current = getTypeLabel;
  const getBranchLabelRef = useRef(getBranchLabel);
  getBranchLabelRef.current = getBranchLabel;
  const skipNextNotifyRef = useRef(true);
  const lastExternalFingerprintRef = useRef("");

  const reactFlowNodes = useMemo(
    () => toReactFlowNodes(flow.nodes, selectedNodeId, getTypeLabel, getBranchLabel, locale),
    [flow.nodes, selectedNodeId, getTypeLabel, getBranchLabel, locale]
  );
  const reactFlowEdges = useMemo(() => toReactFlowEdges(flow.edges, flow.nodes), [flow.edges, flow.nodes]);

  const [nodes, setNodes, onNodesChange] = useNodesState(reactFlowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(reactFlowEdges);

  useEffect(() => {
    const fp = fingerprint(flow.nodes, flow.edges);
    if (fp === lastExternalFingerprintRef.current) return;
    lastExternalFingerprintRef.current = fp;
    skipNextNotifyRef.current = true;
    setNodes(
      toReactFlowNodes(
        flow.nodes,
        selectedNodeIdRef.current,
        getTypeLabelRef.current,
        getBranchLabelRef.current,
        locale
      )
    );
    setEdges(toReactFlowEdges(flow.edges, flow.nodes));
  }, [flow.nodes, flow.edges, locale, setNodes, setEdges]);

  useEffect(() => {
    setNodes((current) => {
      let changed = false;
      const next = current.map((node) => {
        const selected = node.id === selectedNodeId;
        if (Boolean(node.selected) === selected) return node;
        changed = true;
        return { ...node, selected };
      });
      if (!changed) return current;
      skipNextNotifyRef.current = true;
      return next;
    });
  }, [selectedNodeId, setNodes]);

  useEffect(() => {
    if (skipNextNotifyRef.current) {
      skipNextNotifyRef.current = false;
      return;
    }
    const converted = fromReactFlow(nodes, edges, flowRef.current);
    const nextFingerprint = fingerprint(converted.nodes, converted.edges);
    if (nextFingerprint === lastExternalFingerprintRef.current) return;
    lastExternalFingerprintRef.current = nextFingerprint;
    onChangeRef.current(converted.nodes, converted.edges);
  }, [nodes, edges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      const handle = connection.sourceHandle ?? undefined;
      const id = `e-${connection.source}-${handle ?? "default"}-${connection.target}-${Date.now()}`;
      setEdges((eds) =>
        addEdge({ ...connection, id, deletable: true, selectable: true }, eds)
      );
    },
    [setEdges]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onSelectNodeRef.current(node.id);
    },
    []
  );

  const onEdgeClick = useCallback(() => {
    onSelectNodeRef.current(null);
  }, []);

  const onPaneClick = useCallback(() => {
    onSelectNodeRef.current(null);
  }, []);

  const { fitView, screenToFlowPosition } = useReactFlow();

  const initialFitDoneRef = useRef(false);

  useEffect(() => {
    if (initialFitDoneRef.current) return;
    const frame = requestAnimationFrame(() => {
      void fitView({ padding: 0.3, minZoom: 0.9, maxZoom: 1.15, duration: 150 });
      initialFitDoneRef.current = true;
    });
    return () => cancelAnimationFrame(frame);
  }, [fitView]);

  const deleteNode = useCallback(
    (nodeId: string) => {
      const flowNode = flowRef.current.nodes.find((node) => node.id === nodeId);
      if (flowNode?.type === "trigger") {
        const triggers = flowRef.current.nodes.filter((node) => node.type === "trigger").length;
        if (triggers <= 1) {
          onCannotDeleteTriggerRef.current?.();
          return;
        }
      }
      if (nodeId === selectedNodeId) {
        onSelectNodeRef.current(null);
      }
      setNodes((current) => current.filter((node) => node.id !== nodeId));
      setEdges((current) =>
        current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
      );
    },
    [selectedNodeId, setEdges, setNodes]
  );

  const canDeleteNode = useCallback((nodeId: string) => {
    const flowNode = flowRef.current.nodes.find((node) => node.id === nodeId);
    if (!flowNode || flowNode.type !== "trigger") return true;
    return flowRef.current.nodes.filter((node) => node.type === "trigger").length > 1;
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData(FLOW_NODE_DRAG_MIME) as FlowNodeType;
      if (!type) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      onAddNodeRef.current(type, position);
    },
    [screenToFlowPosition]
  );

  const nodeActions = useMemo(
    () => ({ deleteNode, canDeleteNode }),
    [canDeleteNode, deleteNode]
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const removedIds = new Set<string>();
      const filtered = changes.filter((change) => {
        if (change.type !== "remove") return true;
        const flowNode = flowRef.current.nodes.find((n) => n.id === change.id);
        if (flowNode?.type !== "trigger") {
          removedIds.add(change.id);
          return true;
        }
        const triggerCount = flowRef.current.nodes.filter((n) => n.type === "trigger").length;
        if (triggerCount <= 1) {
          onCannotDeleteTriggerRef.current?.();
          return false;
        }
        removedIds.add(change.id);
        return true;
      });
      if (filtered.some((c) => c.type === "remove" && c.id === selectedNodeId)) {
        onSelectNodeRef.current(null);
      }
      onNodesChange(filtered);
      if (removedIds.size > 0) {
        setEdges((current) =>
          current.filter((edge) => !removedIds.has(edge.source) && !removedIds.has(edge.target))
        );
      }
    },
    [onNodesChange, selectedNodeId, setEdges]
  );

  return (
    <FlowNodeActionsContext.Provider value={nodeActions}>
      <div className="react-flow-dark h-full min-h-0 overflow-hidden bg-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={{ deletable: true, selectable: true }}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          onDragOver={onDragOver}
          onDrop={onDrop}
          deleteKeyCode={["Backspace", "Delete"]}
          elevateEdgesOnSelect
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          minZoom={0.5}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="var(--text-muted)" gap={24} size={1} />
          <Controls position="bottom-left" showInteractive={false} />
          <MiniMap
            position="bottom-right"
            pannable
            zoomable
            maskColor="var(--surface)"
            nodeColor="var(--accent)"
            className="!m-3"
            style={{ background: "var(--surface-elevated)", width: 140, height: 90 }}
          />
        </ReactFlow>
      </div>
    </FlowNodeActionsContext.Provider>
  );
}

export function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

export function createDefaultFlowNodes(): FlowNode[] {
  return [
    {
      id: "trigger-1",
      type: "trigger",
      position: { x: 240, y: 40 },
      data: { label: "Start", triggerType: "any_message" },
    },
    {
      id: "message-1",
      type: "message",
      position: { x: 240, y: 200 },
      data: { label: "Welcome", messageText: "Hello! How can we help you?" },
    },
    {
      id: "end-1",
      type: "end",
      position: { x: 240, y: 360 },
      data: { label: "End", haltPipeline: true },
    },
  ];
}

export function createDefaultFlowEdges(): FlowEdge[] {
  return [
    { id: "e1", source: "trigger-1", target: "message-1" },
    { id: "e2", source: "message-1", target: "end-1" },
  ];
}
