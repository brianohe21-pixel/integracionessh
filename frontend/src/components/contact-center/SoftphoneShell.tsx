"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  GripVertical,
  PanelRightClose,
  Pin,
  PinOff,
  X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useSoftphone } from "@/components/contact-center/SoftphoneProvider";
import { useSoftphoneUI } from "@/components/contact-center/SoftphoneUIProvider";
import { SoftphonePanel } from "@/components/contact-center/SoftphonePanel";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useT } from "@/i18n/context";
import { api } from "@/lib/api";
import { isSubaccountServiceEnabled } from "@/lib/subaccount-services";
import type { Tenant } from "@/types";
import { cn } from "@/lib/utils";

const FLOATING_WIDTH = 320;
const FLOATING_MIN_HEIGHT = 520;

function SoftphonePanelChrome({
  children,
  onClose,
  onDock,
  onUndock,
  docked,
  draggable = false,
  floatPosition,
  onFloatPositionChange,
}: {
  children: ReactNode;
  onClose: () => void;
  onDock?: () => void;
  onUndock?: () => void;
  docked: boolean;
  draggable?: boolean;
  floatPosition?: { x: number; y: number };
  onFloatPositionChange?: (position: { x: number; y: number }) => void;
}) {
  const t = useT();
  const dragOffset = useRef({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const clampPosition = useCallback((x: number, y: number) => {
    const maxX = Math.max(16, window.innerWidth - FLOATING_WIDTH - 16);
    const maxY = Math.max(16, window.innerHeight - FLOATING_MIN_HEIGHT - 16);
    return {
      x: Math.min(Math.max(16, x), maxX),
      y: Math.min(Math.max(16, y), maxY),
    };
  }, []);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!draggable || !floatPosition || !onFloatPositionChange || event.button !== 0) return;
      if ((event.target as HTMLElement).closest("button")) return;
      event.preventDefault();
      dragOffset.current = {
        x: event.clientX - floatPosition.x,
        y: event.clientY - floatPosition.y,
      };
      setDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [draggable, floatPosition, onFloatPositionChange]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging || !onFloatPositionChange) return;
      onFloatPositionChange(
        clampPosition(
          event.clientX - dragOffset.current.x,
          event.clientY - dragOffset.current.y
        )
      );
    },
    [clampPosition, dragging, onFloatPositionChange]
  );

  const handlePointerEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, [dragging]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-default bg-surface-elevated shadow-xl">
      <div
        className={cn(
          "flex items-center gap-2 border-b border-default px-3 py-2",
          draggable && "cursor-grab active:cursor-grabbing"
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        {draggable ? <GripVertical className="h-4 w-4 shrink-0 text-muted" /> : null}
        <span className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide text-secondary">
          {t("contactCenter.softphone")}
        </span>
        {docked ? (
          <button
            type="button"
            onClick={onUndock}
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-muted hover:text-primary"
            aria-label={t("contactCenter.undockSoftphone")}
            title={t("contactCenter.undockSoftphone")}
          >
            <PinOff className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onDock}
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-muted hover:text-primary"
            aria-label={t("contactCenter.dockSoftphone")}
            title={t("contactCenter.dockSoftphone")}
          >
            <Pin className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-muted hover:text-primary"
          aria-label={t("contactCenter.closeSoftphone")}
        >
          {docked ? <PanelRightClose className="h-4 w-4" /> : <X className="h-4 w-4" />}
        </button>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

function SoftphoneDockedDrawer() {
  const { open, viewMode, setOpen, undock } = useSoftphoneUI();

  if (!open || viewMode !== "docked") return null;

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close softphone"
        className="fixed inset-0 z-[60] bg-black/30"
        onClick={() => setOpen(false)}
      />
      <aside className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-sm flex-col border-l border-default bg-surface-elevated shadow-2xl">
        <SoftphonePanelChrome
          docked
          onClose={() => setOpen(false)}
          onUndock={undock}
        >
          <SoftphonePanel />
        </SoftphonePanelChrome>
      </aside>
    </>,
    document.body
  );
}

function SoftphoneFloatingPanel() {
  const { open, viewMode, floatPosition, setFloatPosition, setOpen, dock, undock } =
    useSoftphoneUI();

  const clampPosition = useCallback((x: number, y: number) => {
    const maxX = Math.max(16, window.innerWidth - FLOATING_WIDTH - 16);
    const maxY = Math.max(16, window.innerHeight - FLOATING_MIN_HEIGHT - 16);
    return {
      x: Math.min(Math.max(16, x), maxX),
      y: Math.min(Math.max(16, y), maxY),
    };
  }, []);

  useEffect(() => {
    const onResize = () => {
      setFloatPosition(clampPosition(floatPosition.x, floatPosition.y));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clampPosition, floatPosition.x, floatPosition.y, setFloatPosition]);

  if (!open || viewMode !== "floating") return null;

  return createPortal(
    <div
      className="fixed z-[70] w-80"
      style={{
        left: floatPosition.x,
        top: floatPosition.y,
        maxHeight: "calc(100vh - 2rem)",
        minHeight: "520px",
      }}
    >
      <SoftphonePanelChrome
        docked={false}
        draggable
        floatPosition={floatPosition}
        onFloatPositionChange={setFloatPosition}
        onClose={() => setOpen(false)}
        onDock={dock}
        onUndock={undock}
      >
        <SoftphonePanel />
      </SoftphonePanelChrome>
    </div>,
    document.body
  );
}

function SoftphonePanelsInner() {
  const phone = useSoftphone();
  const { open, setOpen } = useSoftphoneUI();
  const { isAdmin } = useAdminRole();
  const { data: me } = useQuery({
    queryKey: ["tenants", "me"],
    queryFn: () => api.get<Tenant>("/tenants/me"),
    enabled: !isAdmin,
  });

  useEffect(() => {
    if (phone.status === "ringing" && !open) {
      setOpen(true);
    }
  }, [open, phone.status, setOpen]);

  if (!isSubaccountServiceEnabled(me, "contactCenter")) return null;

  return (
    <>
      <SoftphoneDockedDrawer />
      <SoftphoneFloatingPanel />
    </>
  );
}

export function SoftphonePanels() {
  return <SoftphonePanelsInner />;
}

export function SoftphoneShell() {
  return <SoftphonePanels />;
}
