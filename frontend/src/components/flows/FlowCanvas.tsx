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
  ReactFlowProvider,
  type Connection,
  type Node,
  type Edge,
  type NodeChange,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { FlowDefinition, FlowEdge, FlowNode, FlowNodeType } from "@/types";
import { FlowNodeCard } from "./FlowNodeCard";
import { buildNodePreview } from "./nodeConfig";

const nodeTypes: NodeTypes = {
  flowNode: FlowNodeCard,
};

function fingerprint(nodes: FlowNode[], edges: FlowEdge[]): string {
  const nodePart = nodes
    .map((n) => `${n.id}:${n.type}:${n.position.x},${n.position.y}:${JSON.stringify(n.data)}`)
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
  getBranchLabel: (key: "true" | "false") => string
): Node[] {
  return nodes.map((n) => ({
    id: n.id,
    type: "flowNode",
    position: n.position,
    selected: n.id === selectedNodeId,
    data: {
      flowType: n.type,
      typeLabel: getTypeLabel(n.type),
      preview: buildNodePreview(n.type, n.data),
      buttons: n.data.buttons,
      trueLabel: getBranchLabel("true"),
      falseLabel: getBranchLabel("false"),
    },
  }));
}

function toReactFlowEdges(edges: FlowEdge[]): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
  }));
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
  getTypeLabel: (type: FlowNodeType) => string;
  getBranchLabel: (key: "true" | "false") => string;
  onCannotDeleteTrigger?: () => void;
}

function FlowCanvasInner({
  flow,
  selectedNodeId,
  onSelectNode,
  onChange,
  getTypeLabel,
  getBranchLabel,
  onCannotDeleteTrigger,
}: FlowCanvasProps) {
  const flowRef = useRef(flow);
  flowRef.current = flow;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onSelectNodeRef = useRef(onSelectNode);
  onSelectNodeRef.current = onSelectNode;
  const onCannotDeleteTriggerRef = useRef(onCannotDeleteTrigger);
  onCannotDeleteTriggerRef.current = onCannotDeleteTrigger;
  const getTypeLabelRef = useRef(getTypeLabel);
  getTypeLabelRef.current = getTypeLabel;
  const getBranchLabelRef = useRef(getBranchLabel);
  getBranchLabelRef.current = getBranchLabel;
  const skipNextNotifyRef = useRef(true);
  const lastExternalFingerprintRef = useRef("");

  const reactFlowNodes = useMemo(
    () => toReactFlowNodes(flow.nodes, selectedNodeId, getTypeLabel, getBranchLabel),
    [flow.nodes, selectedNodeId, getTypeLabel, getBranchLabel]
  );
  const reactFlowEdges = useMemo(() => toReactFlowEdges(flow.edges), [flow.edges]);

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
        selectedNodeId,
        getTypeLabelRef.current,
        getBranchLabelRef.current
      )
    );
    setEdges(toReactFlowEdges(flow.edges));
  }, [flow.nodes, flow.edges, selectedNodeId, setNodes, setEdges]);

  useEffect(() => {
    if (skipNextNotifyRef.current) {
      skipNextNotifyRef.current = false;
      return;
    }
    const converted = fromReactFlow(nodes, edges, flowRef.current);
    lastExternalFingerprintRef.current = fingerprint(converted.nodes, converted.edges);
    onChangeRef.current(converted.nodes, converted.edges);
  }, [nodes, edges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      const handle = connection.sourceHandle ?? undefined;
      const id = `e-${connection.source}-${handle ?? "default"}-${connection.target}-${Date.now()}`;
      setEdges((eds) => addEdge({ ...connection, id }, eds));
    },
    [setEdges]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onSelectNodeRef.current(node.id);
    },
    []
  );

  const onPaneClick = useCallback(() => {
    onSelectNodeRef.current(null);
  }, []);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const filtered = changes.filter((change) => {
        if (change.type !== "remove") return true;
        const flowNode = flowRef.current.nodes.find((n) => n.id === change.id);
        if (flowNode?.type !== "trigger") return true;
        const triggerCount = flowRef.current.nodes.filter((n) => n.type === "trigger").length;
        if (triggerCount <= 1) {
          onCannotDeleteTriggerRef.current?.();
          return false;
        }
        return true;
      });
      if (filtered.some((c) => c.type === "remove" && c.id === selectedNodeId)) {
        onSelectNodeRef.current(null);
      }
      onNodesChange(filtered);
    },
    [onNodesChange, selectedNodeId]
  );

  return (
    <div className="h-[520px] border border-gray-200 rounded-xl overflow-hidden bg-white">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        deleteKeyCode={["Backspace", "Delete"]}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
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
      position: { x: 80, y: 120 },
      data: { label: "Start", triggerType: "any_message" },
    },
    {
      id: "message-1",
      type: "message",
      position: { x: 320, y: 120 },
      data: { label: "Welcome", messageText: "Hello! How can we help you?" },
    },
    {
      id: "end-1",
      type: "end",
      position: { x: 560, y: 120 },
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
