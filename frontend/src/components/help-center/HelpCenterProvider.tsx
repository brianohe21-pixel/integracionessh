"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useHelpCenterStorage, type HelpCenterTab } from "@/hooks/useHelpCenter";
import type { TourId } from "@/lib/help-center/tours";

type HelpCenterContextValue = {
  isOpen: boolean;
  activeTab: HelpCenterTab;
  open: (tab?: HelpCenterTab) => void;
  close: () => void;
  toggle: () => void;
  setActiveTab: (tab: HelpCenterTab) => void;
  pendingTourId: TourId | null;
  requestTour: (tourId: TourId) => void;
  clearPendingTour: () => void;
  completeTour: (tourId: TourId) => void;
  dismissHint: (hintId: string) => void;
  isTourCompleted: (tourId: TourId) => boolean;
  isHintDismissed: (hintId: string) => boolean;
};

const HelpCenterContext = createContext<HelpCenterContextValue | null>(null);

export function HelpCenterProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<HelpCenterTab>("checklist");
  const [pendingTourId, setPendingTourId] = useState<TourId | null>(null);
  const storage = useHelpCenterStorage();

  const open = useCallback((tab?: HelpCenterTab) => {
    if (tab) setActiveTab(tab);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const requestTour = useCallback((tourId: TourId) => {
    setPendingTourId(tourId);
    setActiveTab("tours");
    setIsOpen(false);
  }, []);

  const clearPendingTour = useCallback(() => {
    setPendingTourId(null);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "?" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      toggle();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  const value = useMemo<HelpCenterContextValue>(
    () => ({
      isOpen,
      activeTab,
      open,
      close,
      toggle,
      setActiveTab,
      pendingTourId,
      requestTour,
      clearPendingTour,
      completeTour: storage.completeTour,
      dismissHint: storage.dismissHint,
      isTourCompleted: storage.isTourCompleted,
      isHintDismissed: storage.isHintDismissed,
    }),
    [isOpen, activeTab, open, close, toggle, pendingTourId, requestTour, clearPendingTour, storage]
  );

  return <HelpCenterContext.Provider value={value}>{children}</HelpCenterContext.Provider>;
}

export function useHelpCenter() {
  const context = useContext(HelpCenterContext);
  if (!context) {
    throw new Error("useHelpCenter must be used within HelpCenterProvider");
  }
  return context;
}
