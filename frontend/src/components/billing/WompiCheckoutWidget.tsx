"use client";

import { useEffect, useRef } from "react";
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

export function WompiCheckoutWidget({
  config,
  onApproved,
  onError,
}: {
  config: WompiCheckoutParams;
  onApproved: (transactionId: string) => void;
  onError: (message: string) => void;
}) {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    let cancelled = false;

    void loadWompiWidgetScript()
      .then(() => {
        if (cancelled) return;
        const WidgetCheckout = window.WidgetCheckout;
        if (!WidgetCheckout) {
          onError("Wompi widget unavailable");
          return;
        }

        const checkout = new WidgetCheckout({
          currency: config.currency,
          amountInCents: config.amountInCents,
          reference: config.reference,
          publicKey: config.publicKey,
          redirectUrl: config.redirectUrl,
          signature: { integrity: config.signatureIntegrity },
          customerData: { email: config.customerEmail },
        });

        checkout.open((result) => {
          if (result.transaction.status === "APPROVED") {
            onApproved(result.transaction.id);
            return;
          }
          window.location.href = `/billing/failure?reference=${encodeURIComponent(config.reference)}`;
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        onError(error instanceof Error ? error.message : "Failed to open Wompi");
      });

    return () => {
      cancelled = true;
    };
  }, [config, onApproved, onError]);

  return null;
}
