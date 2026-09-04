"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useT } from "@/i18n/context";
import { useFlowHook } from "@/hooks/useFlows";
import { cn } from "@/lib/utils";
import { FlowWebhookGuide } from "./FlowWebhookGuide";

interface FlowWebhookGuideAccordionProps {
  flowId: string;
  samplePayload?: Record<string, unknown>;
  defaultOpen?: boolean;
}

export function FlowWebhookGuideAccordion({
  flowId,
  samplePayload,
  defaultOpen = true,
}: FlowWebhookGuideAccordionProps) {
  const t = useT();
  const [open, setOpen] = useState(defaultOpen);
  const { data: hookData } = useFlowHook(flowId);

  return (
    <div className="rounded-lg border border-default bg-surface-muted/30">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <span className="text-sm font-semibold text-primary">{t("flows.webhook.guide.title")}</span>
          {!open ? (
            <p className="mt-0.5 text-xs text-secondary">{t("flows.webhook.guide.subtitle")}</p>
          ) : null}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-secondary transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open ? (
        <div className="border-t border-default px-3 py-3">
          <FlowWebhookGuide
            webhookUrl={hookData?.webhookUrl}
            samplePayload={samplePayload}
            hideTitle
            className="border-0 bg-transparent p-0 shadow-none"
          />
        </div>
      ) : null}
    </div>
  );
}
