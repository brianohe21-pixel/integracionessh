"use client";

import { ConversationWorkspace } from "@/components/conversations/ConversationWorkspace";

export default function InboxPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ConversationWorkspace advisorMode />
    </div>
  );
}
