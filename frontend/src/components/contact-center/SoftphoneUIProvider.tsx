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

export type SoftphoneViewMode = "docked" | "floating";

type SoftphoneUIContextValue = {
  open: boolean;
  viewMode: SoftphoneViewMode;
  floatPosition: { x: number; y: number };
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  dock: () => void;
  undock: () => void;
  setFloatPosition: (position: { x: number; y: number }) => void;
};

const SoftphoneUIContext = createContext<SoftphoneUIContextValue | null>(null);

const MODE_STORAGE_KEY = "softphone-view-mode";
const POSITION_STORAGE_KEY = "softphone-float-position";

function readStoredMode(): SoftphoneViewMode {
  if (typeof window === "undefined") return "docked";
  const value = window.localStorage.getItem(MODE_STORAGE_KEY);
  return value === "floating" ? "floating" : "docked";
}

function readStoredPosition(): { x: number; y: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(POSITION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { x?: number; y?: number };
    if (typeof parsed.x === "number" && typeof parsed.y === "number") {
      return { x: parsed.x, y: parsed.y };
    }
  } catch {
    return null;
  }
  return null;
}

function defaultFloatPosition() {
  if (typeof window === "undefined") return { x: 24, y: 96 };
  const width = 320;
  const height = 420;
  return {
    x: Math.max(16, window.innerWidth - width - 24),
    y: Math.max(72, window.innerHeight - height - 24),
  };
}

export function SoftphoneUIProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<SoftphoneViewMode>("docked");
  const [floatPosition, setFloatPositionState] = useState({ x: 24, y: 96 });

  useEffect(() => {
    setViewMode(readStoredMode());
    setFloatPositionState(readStoredPosition() ?? defaultFloatPosition());
  }, []);

  const setFloatPosition = useCallback((position: { x: number; y: number }) => {
    setFloatPositionState(position);
    window.localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(position));
  }, []);

  const dock = useCallback(() => {
    setViewMode("docked");
    setOpen(true);
    window.localStorage.setItem(MODE_STORAGE_KEY, "docked");
  }, []);

  const undock = useCallback(() => {
    const next = readStoredPosition() ?? defaultFloatPosition();
    setFloatPositionState(next);
    window.localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(next));
    setViewMode("floating");
    setOpen(true);
    window.localStorage.setItem(MODE_STORAGE_KEY, "floating");
  }, []);

  const toggleOpen = useCallback(() => {
    setOpen((current) => !current);
  }, []);

  const value = useMemo(
    () => ({
      open,
      viewMode,
      floatPosition,
      setOpen,
      toggleOpen,
      dock,
      undock,
      setFloatPosition,
    }),
    [dock, floatPosition, open, setFloatPosition, toggleOpen, undock, viewMode]
  );

  return <SoftphoneUIContext.Provider value={value}>{children}</SoftphoneUIContext.Provider>;
}

export function useSoftphoneUI() {
  const context = useContext(SoftphoneUIContext);
  if (!context) {
    throw new Error("useSoftphoneUI must be used within SoftphoneUIProvider");
  }
  return context;
}
