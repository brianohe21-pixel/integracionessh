"use client";

import { createContext, useContext } from "react";

interface FlowNodeActionsContextValue {
  deleteNode: (nodeId: string) => void;
  canDeleteNode: (nodeId: string) => boolean;
}

export const FlowNodeActionsContext = createContext<FlowNodeActionsContextValue | null>(null);

export function useFlowNodeActions() {
  return useContext(FlowNodeActionsContext);
}
