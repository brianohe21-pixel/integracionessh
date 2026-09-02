"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function AiAssistantAgentRedirectPage() {
  const router = useRouter();
  const { botId } = useParams<{ botId: string }>();

  useEffect(() => {
    router.replace(`/bots/${botId}/edit?tab=aiAssistant`);
  }, [botId, router]);

  return null;
}
