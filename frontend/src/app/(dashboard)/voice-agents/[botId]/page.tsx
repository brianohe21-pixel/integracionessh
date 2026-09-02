"use client";

import { useEffect, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { isVoiceAgentDetailTab } from "@/lib/voice-agent-sections";

export default function VoiceAgentDetailPage() {
  const router = useRouter();
  const { botId } = useParams<{ botId: string }>();
  const searchParams = useSearchParams();

  const section = useMemo(() => {
    const value = searchParams.get("tab");
    return isVoiceAgentDetailTab(value) ? value : "overview";
  }, [searchParams]);

  useEffect(() => {
    if (!botId) return;
    router.replace(`/voice-agents?agent=${encodeURIComponent(botId)}&section=${section}`);
  }, [botId, router, section]);

  return (
    <DashboardPage>
      <div className="h-40 animate-pulse rounded-xl bg-surface-muted" />
    </DashboardPage>
  );
}
