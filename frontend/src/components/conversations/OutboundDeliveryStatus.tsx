"use client";

import { AlertCircle, Check, CheckCheck, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Channel, MessageDeliveryStatus } from "@/types";

type Props = {
  channel?: Channel;
  status?: MessageDeliveryStatus;
};

export function OutboundDeliveryStatus({ channel, status }: Props) {
  if (channel && channel !== "whatsapp") {
    if (status === "pending") {
      return <Clock className="h-3 w-3 text-secondary" aria-hidden />;
    }
    if (status === "failed") {
      return <AlertCircle className="h-3 w-3 text-danger" aria-hidden />;
    }
    return <Check className="h-3 w-3 text-secondary" aria-hidden />;
  }

  if (status === "pending") {
    return <Clock className="h-3 w-3 animate-pulse text-secondary" aria-hidden />;
  }

  if (status === "failed") {
    return <AlertCircle className="h-3 w-3 text-danger" aria-hidden />;
  }

  if (status === "sent") {
    return <Check className="h-3 w-3 text-secondary" aria-hidden />;
  }

  if (status === "delivered") {
    return <CheckCheck className="h-3 w-3 text-secondary" aria-hidden />;
  }

  if (status === "read") {
    return <CheckCheck className={cn("h-3 w-3 text-accent")} aria-hidden />;
  }

  return <Check className="h-3 w-3 text-secondary" aria-hidden />;
}
