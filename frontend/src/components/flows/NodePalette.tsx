"use client";

import { useT } from "@/i18n/context";
import type { FlowNodeType } from "@/types";
import { CATEGORY_STYLES, FLOW_NODE_CATEGORIES, FLOW_NODE_META, FLOW_PALETTE_NODES } from "./nodeConfig";

interface NodePaletteProps {
  onAddNode: (type: FlowNodeType) => void;
}

export function NodePalette({ onAddNode }: NodePaletteProps) {
  const t = useT();

  return (
    <div className="space-y-3.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("flows.components")}</p>
      {FLOW_NODE_CATEGORIES.map((category) => (
        <div key={category}>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
            {t(`flows.nodeCategories.${category}`)}
          </p>
          <div className="space-y-0.5">
            {FLOW_PALETTE_NODES[category].map((type) => {
              const meta = FLOW_NODE_META[type];
              const styles = CATEGORY_STYLES[meta.category];
              const Icon = meta.icon;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => onAddNode(type)}
                  className="flex w-full items-center gap-2 rounded-md border border-default bg-surface-muted/50 px-2 py-1.5 text-left text-[11px] font-medium text-primary transition-colors hover:border-accent/40 hover:bg-accent-muted"
                >
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${styles.icon}`} />
                  <span className="truncate">{t(`flows.nodeTypes.${type}`)}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
