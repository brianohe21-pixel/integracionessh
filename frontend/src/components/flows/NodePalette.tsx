"use client";

import { useT } from "@/i18n/context";
import type { FlowNodeType } from "@/types";
import { FLOW_NODE_CATEGORIES, FLOW_PALETTE_NODES } from "./nodeConfig";

interface NodePaletteProps {
  onAddNode: (type: FlowNodeType) => void;
}

export function NodePalette({ onAddNode }: NodePaletteProps) {
  const t = useT();

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-gray-900">{t("flows.addNode")}</p>
      {FLOW_NODE_CATEGORIES.map((category) => (
        <div key={category}>
          <p className="text-xs font-medium text-gray-500 mb-1.5">
            {t(`flows.nodeCategories.${category}`)}
          </p>
          <div className="flex flex-wrap gap-1">
            {FLOW_PALETTE_NODES[category].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => onAddNode(type)}
                className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 text-gray-800"
              >
                {t(`flows.nodeTypes.${type}`)}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
