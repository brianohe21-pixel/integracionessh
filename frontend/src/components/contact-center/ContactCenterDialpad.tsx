"use client";

import { SoftphoneDialpad } from "@/components/contact-center/SoftphoneDialpad";

interface ContactCenterDialpadProps {
  botId: string;
  fromNumber?: string;
}

export function ContactCenterDialpad({ botId, fromNumber }: ContactCenterDialpadProps) {
  return (
    <div className="content-card mx-auto max-w-md space-y-4 p-6">
      <SoftphoneDialpad botId={botId} fromNumber={fromNumber} showHeader />
    </div>
  );
}
