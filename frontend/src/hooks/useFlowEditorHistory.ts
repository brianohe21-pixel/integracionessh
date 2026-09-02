import { useCallback, useRef, useState } from "react";
import type { FlowEdge, FlowNode } from "@/types";

export interface FlowEditorSnapshot {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

const MAX_HISTORY = 50;

function cloneSnapshot(snapshot: FlowEditorSnapshot): FlowEditorSnapshot {
  return structuredClone(snapshot);
}

function snapshotsEqual(a: FlowEditorSnapshot, b: FlowEditorSnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function useFlowEditorHistory() {
  const presentRef = useRef<FlowEditorSnapshot>({ nodes: [], edges: [] });
  const pastRef = useRef<FlowEditorSnapshot[]>([]);
  const futureRef = useRef<FlowEditorSnapshot[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingBeforeRef = useRef<FlowEditorSnapshot | null>(null);

  const [state, setState] = useState<FlowEditorSnapshot>({ nodes: [], edges: [] });
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncMeta = useCallback(() => {
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(futureRef.current.length > 0);
  }, []);

  const apply = useCallback(
    (snapshot: FlowEditorSnapshot) => {
      const cloned = cloneSnapshot(snapshot);
      presentRef.current = cloned;
      setState(cloned);
    },
    []
  );

  const flushPending = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (
      pendingBeforeRef.current &&
      !snapshotsEqual(pendingBeforeRef.current, presentRef.current)
    ) {
      pastRef.current.push(pendingBeforeRef.current);
      if (pastRef.current.length > MAX_HISTORY) pastRef.current.shift();
      futureRef.current = [];
    }
    pendingBeforeRef.current = null;
  }, []);

  const reset = useCallback(
    (snapshot: FlowEditorSnapshot) => {
      flushPending();
      const cloned = cloneSnapshot(snapshot);
      presentRef.current = cloned;
      pastRef.current = [];
      futureRef.current = [];
      setState(cloned);
      syncMeta();
    },
    [flushPending, syncMeta]
  );

  const commit = useCallback(
    (next: FlowEditorSnapshot, options?: { debounce?: boolean }) => {
      const cloned = cloneSnapshot(next);

      if (!options?.debounce) {
        flushPending();
        if (!snapshotsEqual(presentRef.current, cloned)) {
          pastRef.current.push(cloneSnapshot(presentRef.current));
          if (pastRef.current.length > MAX_HISTORY) pastRef.current.shift();
          futureRef.current = [];
        }
        apply(cloned);
        syncMeta();
        return;
      }

      if (!pendingBeforeRef.current) {
        pendingBeforeRef.current = cloneSnapshot(presentRef.current);
      }
      apply(cloned);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        flushPending();
        syncMeta();
        debounceRef.current = null;
      }, 400);
    },
    [apply, flushPending, syncMeta]
  );

  const undo = useCallback(() => {
    flushPending();
    const previous = pastRef.current.pop();
    if (!previous) {
      syncMeta();
      return;
    }
    futureRef.current.push(cloneSnapshot(presentRef.current));
    apply(previous);
    syncMeta();
  }, [apply, flushPending, syncMeta]);

  const redo = useCallback(() => {
    flushPending();
    const next = futureRef.current.pop();
    if (!next) {
      syncMeta();
      return;
    }
    pastRef.current.push(cloneSnapshot(presentRef.current));
    apply(next);
    syncMeta();
  }, [apply, flushPending, syncMeta]);

  return {
    nodes: state.nodes,
    edges: state.edges,
    canUndo,
    canRedo,
    reset,
    commit,
    undo,
    redo,
  };
}
