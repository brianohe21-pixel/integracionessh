"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { FlowNodeType } from "@/types";
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
      ? (nodeData.buttons?.length ? nodeData.buttons : [{ id: "btn-1", title: "…" }])
      : [];

  return (
    <div
      className={`min-w-[180px] max-w-[220px] rounded-xl border-2 shadow-sm px-3 py-2.5 ${styles.border} ${styles.bg} ${
        selected ? "ring-2 ring-indigo-500 ring-offset-1" : ""
      }`}
    >
      {meta.hasInput && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-2.5 !h-2.5 !bg-gray-500 !border-2 !border-white"
        />
      )}

      <div className="flex items-start gap-2">
        <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${styles.icon}`} />
        <div className="min-w-0 flex-1">
          <span className={`inline-block text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${styles.badge}`}>
            {nodeData.typeLabel}
          </span>
          {nodeData.preview ? (
            <p className="mt-1 text-xs text-gray-700 line-clamp-2 break-words">{nodeData.preview}</p>
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
            className="!w-2.5 !h-2.5 !bg-emerald-500 !border-2 !border-white"
          />
          <Handle
            type="source"
            id="false"
            position={Position.Bottom}
            style={{ left: "75%" }}
            className="!w-2.5 !h-2.5 !bg-red-500 !border-2 !border-white"
          />
          <span className="absolute left-[18%] -bottom-4 text-[9px] text-emerald-700 font-medium">
            {nodeData.trueLabel ?? "true"}
          </span>
          <span className="absolute left-[68%] -bottom-4 text-[9px] text-red-700 font-medium">
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
                  className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white"
                />
                <span
                  className="absolute -bottom-4 text-[9px] text-gray-600 max-w-[56px] truncate text-center"
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
          className="!w-2.5 !h-2.5 !bg-gray-500 !border-2 !border-white"
        />
      )}
    </div>
  );
}

export const FlowNodeCard = memo(FlowNodeCardComponent);
