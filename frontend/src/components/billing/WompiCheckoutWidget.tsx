"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WompiCheckoutParams } from "@/hooks/useBilling";

interface WompiWidgetTransaction {
  id: string;
  status: string;
}

interface WompiWidgetResult {
  transaction: WompiWidgetTransaction;
}

interface WompiWidgetCheckout {
  open: (callback: (result: WompiWidgetResult) => void) => void;
}

declare global {
  interface Window {
    WidgetCheckout?: new (config: Record<string, unknown>) => WompiWidgetCheckout;
  }
}

const WOMPI_WIDGET_SCRIPT = "https://checkout.wompi.co/widget.js";

let scriptPromise: Promise<void> | null = null;

function loadWompiWidgetScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Wompi widget is only available in the browser"));
  }
  if (window.WidgetCheckout) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${WOMPI_WIDGET_SCRIPT}"]`
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Wompi")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = WOMPI_WIDGET_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Wompi"));
    document.body.appendChild(script);
  });

  return scriptPromise;
}

export function dismissWompiOverlay(): void {
  if (typeof document === "undefined") return;

  document.querySelectorAll('iframe[src*="wompi"]').forEach((iframe) => {
    let node: HTMLElement | null = iframe as HTMLElement;
    while (node?.parentElement && node.parentElement !== document.body) {
      node = node.parentElement;
    }
    node?.remove();
  });

  document.body.style.overflow = "";
  document.body.style.position = "";
}

export function WompiCheckoutWidget({
  config,
  open,
  onApproved,
  onDismiss,
  onError,
}: {
  config: WompiCheckoutParams;
  open: boolean;
  onApproved: (transactionId: string) => void;
  onDismiss: () => void;
  onError: (message: string) => void;
}) {
  const checkoutRef = useRef<WompiWidgetCheckout | null>(null);
  const openingRef = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    checkoutRef.current = null;

    void loadWompiWidgetScript()
      .then(() => {
        if (cancelled) return;
        const WidgetCheckout = window.WidgetCheckout;
        if (!WidgetCheckout) {
          onError("Wompi widget unavailable");
          return;
        }

        checkoutRef.current = new WidgetCheckout({
          currency: config.currency,
          amountInCents: config.amountInCents,
          reference: config.reference,
          publicKey: config.publicKey,
          redirectUrl: config.redirectUrl,
          signature: { integrity: config.signatureIntegrity },
          customerData: { email: config.customerEmail },
        });
        setReady(true);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        onError(error instanceof Error ? error.message : "Failed to open Wompi");
      });

    return () => {
      cancelled = true;
      checkoutRef.current = null;
      setReady(false);
    };
  }, [config, onError]);

  const launchCheckout = useCallback(() => {
    if (!checkoutRef.current || openingRef.current) return;
    openingRef.current = true;

    checkoutRef.current.open((result) => {
      openingRef.current = false;
      dismissWompiOverlay();

      if (result.transaction.status === "APPROVED") {
        onApproved(result.transaction.id);
        return;
      }

      onDismiss();
    });
  }, [onApproved, onDismiss]);

  useEffect(() => {
    if (!open) {
      openingRef.current = false;
      dismissWompiOverlay();
      return;
    }

    if (!ready) return;
    launchCheckout();
  }, [open, ready, launchCheckout]);

  return null;
}
