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
  type Connection,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { FlowDefinition, FlowEdge, FlowNode, FlowNodeType } from "@/types";

function toReactFlowNodes(nodes: FlowNode[]): Node[] {
  return nodes.map((n) => ({
    id: n.id,
    type: "default",
    position: n.position,
    data: { label: `${n.type}${n.data.label ? `: ${n.data.label}` : ""}` },
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
      data: existing?.data ?? { label: String(n.data.label ?? "") },
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
  onChange: (nodes: FlowNode[], edges: FlowEdge[]) => void;
}

export function FlowCanvas({ flow, onChange }: FlowCanvasProps) {
  const flowRef = useRef(flow);
  flowRef.current = flow;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const skipNextNotifyRef = useRef(true);

  const initialNodes = useMemo(() => toReactFlowNodes(flow.nodes), [flow.nodes]);
  const initialEdges = useMemo(() => toReactFlowEdges(flow.edges), [flow.edges]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    if (skipNextNotifyRef.current) {
      skipNextNotifyRef.current = false;
      return;
    }
    const converted = fromReactFlow(nodes, edges, flowRef.current);
    onChangeRef.current(converted.nodes, converted.edges);
  }, [nodes, edges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge({ ...connection, id: `e-${connection.source}-${connection.target}` }, eds)
      );
    },
    [setEdges]
  );

  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      onNodesChange(changes);
    },
    [onNodesChange]
  );

  return (
    <div className="h-[520px] border border-gray-200 rounded-xl overflow-hidden bg-white">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
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
