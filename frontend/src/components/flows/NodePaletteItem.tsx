"use client";

import type { FlowNodeType } from "@/types";
import { useT } from "@/i18n/context";
import { FLOW_NODE_DRAG_MIME } from "@/lib/flow-node-factory";
import { CATEGORY_STYLES, FLOW_NODE_META } from "./nodeConfig";
import { NodeHelpPopover } from "./NodeHelpPopover";

interface NodePaletteItemProps {
  type: FlowNodeType;
  onAddNode: (type: FlowNodeType) => void;
}

export function NodePaletteItem({ type, onAddNode }: NodePaletteItemProps) {
  const t = useT();
  const meta = FLOW_NODE_META[type];
  const styles = CATEGORY_STYLES[meta.category];
  const Icon = meta.icon;

  return (
    <NodeHelpPopover
      type={type}
      side="top"
      showAddAction
      onAdd={() => onAddNode(type)}
      className="min-w-0"
    >
      <button
        type="button"
        draggable
        onDragStart={(event) => {
          event.dataTransfer.setData(FLOW_NODE_DRAG_MIME, type);
          event.dataTransfer.effectAllowed = "move";
        }}
        onClick={() => onAddNode(type)}
        className="flex w-full cursor-grab items-center gap-2 rounded-md border border-default bg-surface-muted/50 px-2 py-1.5 text-left text-[11px] font-medium text-primary transition-colors hover:border-accent/40 hover:bg-accent-muted active:cursor-grabbing"
      >
        <Icon className={`h-3.5 w-3.5 shrink-0 ${styles.icon}`} />
        <span className="truncate">{t(`flows.nodeTypes.${type}`)}</span>
      </button>
    </NodeHelpPopover>
  );
}
