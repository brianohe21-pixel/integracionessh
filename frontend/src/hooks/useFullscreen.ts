import { useCallback, useEffect, useState, type RefObject } from "react";

export function useFullscreen<T extends HTMLElement>(targetRef: RefObject<T | null>) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === targetRef.current);
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [targetRef]);

  const toggle = useCallback(async () => {
    const element = targetRef.current;
    if (!element) return;

    if (document.fullscreenElement === element) {
      await document.exitFullscreen();
      return;
    }

    await element.requestFullscreen();
  }, [targetRef]);

  return { isFullscreen, toggle };
}
