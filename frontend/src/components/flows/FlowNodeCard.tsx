"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { FlowNodeType } from "@/types";
import { cn } from "@/lib/utils";
import { CATEGORY_STYLES, FLOW_NODE_META } from "./nodeConfig";

export interface FlowNodeCardData {
  flowType: FlowNodeType;
  typeLabel: string;
  preview: string;
  buttons?: Array<{ id: string; title: string }>;
  trueLabel?: string;
  falseLabel?: string;
  [key: string]: unknown;
}

function FlowNodeCardComponent({ data, selected }: NodeProps) {
  const nodeData = data as FlowNodeCardData;
  const meta = FLOW_NODE_META[nodeData.flowType];
  const styles = CATEGORY_STYLES[meta.category];
  const Icon = meta.icon;
  const buttons =
    nodeData.flowType === "buttons"
      ? nodeData.buttons?.length
        ? nodeData.buttons
        : [{ id: "btn-1", title: "…" }]
      : [];

  return (
    <div
      className={cn(
        "min-w-[220px] max-w-[280px] rounded-xl border px-4 py-3 shadow-lg shadow-black/25",
        styles.border,
        styles.bg,
        selected && "ring-2 ring-accent ring-offset-2 ring-offset-canvas"
      )}
    >
      {meta.hasInput && (
        <Handle
          type="target"
          position={Position.Top}
          className={cn("!h-2.5 !w-2.5 !border-2 !border-surface-elevated", styles.handle)}
        />
      )}

      <div className="flex items-start gap-2.5">
        <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", styles.icon)} />
        <div className="min-w-0 flex-1">
          <span
            className={cn(
              "inline-block rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
              styles.badge
            )}
          >
            {nodeData.typeLabel}
          </span>
          {nodeData.preview ? (
            <p className="mt-1.5 line-clamp-3 break-words text-sm leading-snug text-secondary">
              {nodeData.preview}
            </p>
          ) : null}
        </div>
      </div>

      {meta.branchHandles === "condition" && meta.hasOutput && (
        <div className="relative mt-4 h-6">
          <Handle
            type="source"
            id="true"
            position={Position.Bottom}
            style={{ left: "25%" }}
            className="!h-2.5 !w-2.5 !border-2 !border-surface-elevated !bg-success"
          />
          <Handle
            type="source"
            id="false"
            position={Position.Bottom}
            style={{ left: "75%" }}
            className="!h-2.5 !w-2.5 !border-2 !border-surface-elevated !bg-danger"
          />
          <span className="absolute -bottom-4 left-[18%] text-[9px] font-medium text-success">
            {nodeData.trueLabel ?? "true"}
          </span>
          <span className="absolute -bottom-4 left-[68%] text-[9px] font-medium text-danger">
            {nodeData.falseLabel ?? "false"}
          </span>
        </div>
      )}

      {meta.branchHandles === "buttons" && meta.hasOutput && (
        <div className="relative mt-3 h-10">
          {buttons.map((btn, i) => {
            const left = buttons.length === 1 ? "50%" : `${((i + 1) / (buttons.length + 1)) * 100}%`;
            return (
              <div key={btn.id}>
                <Handle
                  type="source"
                  id={btn.id}
                  position={Position.Bottom}
                  style={{ left }}
                  className="!h-2.5 !w-2.5 !border-2 !border-surface-elevated !bg-info"
                />
                <span
                  className="absolute -bottom-4 max-w-[56px] truncate text-center text-[9px] text-muted"
                  style={{ left, transform: "translateX(-50%)" }}
                >
                  {btn.title || `#${i + 1}`}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {meta.hasOutput && !meta.branchHandles && (
        <Handle
          type="source"
          position={Position.Bottom}
          className={cn("!h-2.5 !w-2.5 !border-2 !border-surface-elevated", styles.handle)}
        />
      )}
    </div>
  );
}

export const FlowNodeCard = memo(FlowNodeCardComponent);
