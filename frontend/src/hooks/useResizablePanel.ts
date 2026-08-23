"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

interface UseResizablePanelOptions {
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  storageKey?: string;
}

function readStoredWidth(
  storageKey: string | undefined,
  defaultWidth: number,
  minWidth: number,
  maxWidth: number
) {
  if (typeof window === "undefined" || !storageKey) return defaultWidth;

  try {
    const stored = localStorage.getItem(storageKey);
    const parsed = stored ? Number(stored) : Number.NaN;
    if (Number.isFinite(parsed)) {
      return Math.min(maxWidth, Math.max(minWidth, parsed));
    }
  } catch {
    /* ignore */
  }

  return defaultWidth;
}

export function useResizablePanel({
  defaultWidth,
  minWidth,
  maxWidth,
  storageKey,
}: UseResizablePanelOptions) {
  const panelRef = useRef<HTMLElement | null>(null);
  const widthRef = useRef(defaultWidth);
  const [width, setWidth] = useState(() =>
    readStoredWidth(storageKey, defaultWidth, minWidth, maxWidth)
  );
  const [isResizing, setIsResizing] = useState(false);

  widthRef.current = width;

  const startResize = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    function onMouseMove(event: MouseEvent) {
      const panel = panelRef.current;
      if (!panel) return;

      const next = event.clientX - panel.getBoundingClientRect().left;
      setWidth(Math.min(maxWidth, Math.max(minWidth, next)));
    }

    function onMouseUp() {
      setIsResizing(false);

      if (storageKey) {
        try {
          localStorage.setItem(storageKey, String(widthRef.current));
        } catch {
          /* ignore */
        }
      }
    }

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [isResizing, maxWidth, minWidth, storageKey]);

  return {
    panelRef: panelRef as RefObject<HTMLElement>,
    width,
    isResizing,
    startResize,
  };
}
