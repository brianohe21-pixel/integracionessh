"use client";

import { useT } from "@/i18n/context";
import type { FlowNodeType } from "@/types";
import { FLOW_NODE_CATEGORIES, FLOW_PALETTE_NODES } from "./nodeConfig";
import { NodePaletteItem } from "./NodePaletteItem";

interface NodePaletteProps {
  onAddNode: (type: FlowNodeType) => void;
}

export function NodePalette({ onAddNode }: NodePaletteProps) {
  const t = useT();

  return (
    <div className="min-w-0 space-y-3.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("flows.components")}</p>
      <p className="text-[10px] text-secondary">{t("flows.paletteDragHint")}</p>
      {FLOW_NODE_CATEGORIES.map((category) => (
        <div key={category}>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
            {t(`flows.nodeCategories.${category}`)}
          </p>
          <div className="space-y-0.5">
            {FLOW_PALETTE_NODES[category].map((type) => (
              <NodePaletteItem key={type} type={type} onAddNode={onAddNode} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
