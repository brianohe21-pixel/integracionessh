"use client";

import { useEffect, useRef, useState } from "react";
import {
  BaseEdge,
  EdgeToolbar,
  getBezierPath,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";
import { Trash2 } from "lucide-react";
import { useT } from "@/i18n/context";

export function FlowDeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  selected,
  className,
}: EdgeProps) {
  const t = useT();
  const { deleteElements } = useReactFlow();
  const [hovered, setHovered] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  function clearHideTimer() {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }

  function showDelete() {
    clearHideTimer();
    setHovered(true);
  }

  function hideDelete() {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      setHovered(false);
      hideTimerRef.current = null;
    }, 120);
  }

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  return (
    <>
      <g onMouseEnter={showDelete} onMouseLeave={hideDelete}>
        <BaseEdge
          id={id}
          path={edgePath}
          markerEnd={markerEnd}
          style={style}
          className={className}
          interactionWidth={32}
        />
      </g>
      <EdgeToolbar edgeId={id} x={labelX} y={labelY} isVisible={Boolean(selected || hovered)}>
        <button
          type="button"
          className="nodrag nopan flex h-6 w-6 items-center justify-center rounded-full border border-default bg-surface-elevated text-danger shadow-sm hover:bg-danger/10"
          aria-label={t("flows.deleteEdge")}
          onMouseEnter={showDelete}
          onMouseLeave={hideDelete}
          onClick={(event) => {
            event.stopPropagation();
            void deleteElements({ edges: [{ id }] });
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </EdgeToolbar>
    </>
  );
}
