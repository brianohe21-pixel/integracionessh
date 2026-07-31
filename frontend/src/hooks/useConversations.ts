"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRealtimeConnection } from "@/components/realtime/RealtimeProvider";
import type {
  BulkHandoffResult,
  Channel,
  Conversation,
  ConversationsListResponse,
  HandoffMode,
  Message,
  WorkflowStatus,
} from "@/types";

const CONVERSATIONS_PAGE_SIZE = 20;

function isConversation(value: unknown): value is Conversation {
  return (
    value != null &&
    typeof value === "object" &&
    "conversationId" in value &&
    typeof (value as Conversation).conversationId === "string"
  );
}

function normalizeConversationsPage(raw: unknown): ConversationsListResponse {
  if (Array.isArray(raw)) {
    return { items: raw.filter(isConversation) };
  }

  if (raw != null && typeof raw === "object" && "items" in raw) {
    const page = raw as ConversationsListResponse;
    const items = Array.isArray(page.items) ? page.items.filter(isConversation) : [];
    return {
      items,
      ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
    };
  }

  return { items: [] };
}

function conversationsListQueryKey(options?: {
  botId?: string;
  channel?: Channel;
  handoffMode?: HandoffMode;
  workflowStatus?: WorkflowStatus;
  status?: "active" | "closed";
  assignedAdvisorId?: string;
  assignment?: "assigned" | "unassigned";
}) {
  return [
    "conversations",
    "list",
    options?.botId ?? "all",
    options?.channel ?? "all",
    options?.handoffMode ?? "all",
    options?.workflowStatus ?? "all",
    options?.status ?? "all",
    options?.assignedAdvisorId ?? "all",
    options?.assignment ?? "all",
  ] as const;
}

function fetchConversationsPage(
  pageParam: string | undefined,
  options?: {
    botId?: string;
    channel?: Channel;
    handoffMode?: HandoffMode;
    workflowStatus?: WorkflowStatus;
    status?: "active" | "closed";
    assignedAdvisorId?: string;
    assignment?: "assigned" | "unassigned";
  }
): Promise<ConversationsListResponse> {
  const params = new URLSearchParams({ limit: String(CONVERSATIONS_PAGE_SIZE) });
  if (pageParam) params.set("cursor", pageParam);
  if (options?.botId) params.set("botId", options.botId);
  if (options?.channel) params.set("channel", options.channel);
  if (options?.handoffMode) params.set("handoffMode", options.handoffMode);
  if (options?.workflowStatus) params.set("workflowStatus", options.workflowStatus);
  if (options?.status) params.set("status", options.status);
  if (options?.assignedAdvisorId) params.set("assignedAdvisorId", options.assignedAdvisorId);
  if (options?.assignment) params.set("assignment", options.assignment);
  return api.get<unknown>(`/conversations?${params.toString()}`).then(normalizeConversationsPage);
}

export function useConversations(options?: {
  botId?: string;
  channel?: Channel;
  handoffMode?: HandoffMode;
  workflowStatus?: WorkflowStatus;
  status?: "active" | "closed";
  assignedAdvisorId?: string;
  assignment?: "assigned" | "unassigned";
}) {
  return useInfiniteQuery({
    queryKey: conversationsListQueryKey(options),
    queryFn: ({ pageParam }) => fetchConversationsPage(pageParam, options),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor,
  });
}

export function useConversationMessages(conversationId: string, enabled = true) {
  const { connected } = useRealtimeConnection();

  return useQuery({
    queryKey: ["conversation-messages", conversationId],
    queryFn: async () => {
      const raw = await api.get<unknown>(
        `/conversations/${encodeURIComponent(conversationId)}`
      );
      return Array.isArray(raw) ? (raw as Message[]) : [];
    },
    enabled: !!conversationId && enabled,
    refetchInterval: connected ? false : 30_000,
    refetchIntervalInBackground: false,
  });
}

export function useHandoffConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { conversationId: string; botId: string; advisorId?: string }) =>
      api.post<Conversation>(
        `/conversations/${encodeURIComponent(body.conversationId)}/handoff`,
        { botId: body.botId, advisorId: body.advisorId }
      ),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["conversation-messages", vars.conversationId] });
      qc.invalidateQueries({ queryKey: ["metrics", "advisor-workload"] });
      qc.invalidateQueries({ queryKey: ["metrics", "marketing"] });
    },
  });
}

export function useBulkHandoffConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      items: { conversationId: string; botId: string }[];
      advisorId?: string;
    }) =>
      api.post<BulkHandoffResult>("/conversations/bulk-handoff", {
        items: body.items,
        advisorId: body.advisorId,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["metrics", "advisor-workload"] });
      qc.invalidateQueries({ queryKey: ["metrics", "marketing"] });
    },
  });
}

export function useClaimConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { conversationId: string; botId: string }) =>
      api.post<Conversation>(
        `/conversations/${encodeURIComponent(body.conversationId)}/claim`,
        { botId: body.botId }
      ),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["conversation-messages", vars.conversationId] });
      qc.invalidateQueries({ queryKey: ["metrics", "advisor-workload"] });
      qc.invalidateQueries({ queryKey: ["metrics", "marketing"] });
    },
  });
}

export function useReleaseConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { conversationId: string; botId: string }) =>
      api.post<Conversation>(
        `/conversations/${encodeURIComponent(body.conversationId)}/release`,
        { botId: body.botId }
      ),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["conversation-messages", vars.conversationId] });
    },
  });
}

export function useSendConversationMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { conversationId: string; botId: string; content: string }) =>
      api.post<Message>(
        `/conversations/${encodeURIComponent(body.conversationId)}/messages`,
        { botId: body.botId, content: body.content }
      ),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["conversation-messages", vars.conversationId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useUpdateConversationStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      conversationId: string;
      botId: string;
      workflowStatus: WorkflowStatus;
    }) =>
      api.patch<Conversation>(
        `/conversations/${encodeURIComponent(body.conversationId)}/status`,
        { botId: body.botId, workflowStatus: body.workflowStatus }
      ),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["conversation-messages", vars.conversationId] });
    },
  });
}

export function useUpdateConversationNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { conversationId: string; botId: string; internalNote: string }) =>
      api.patch<Conversation>(
        `/conversations/${encodeURIComponent(body.conversationId)}/note`,
        { botId: body.botId, internalNote: body.internalNote }
      ),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["conversation-messages", vars.conversationId] });
    },
  });
}

export function useResolveConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      conversationId: string;
      botId: string;
      csatScore?: number;
      releaseToBot?: boolean;
    }) =>
      api.post<Conversation>(
        `/conversations/${encodeURIComponent(body.conversationId)}/resolve`,
        {
          botId: body.botId,
          ...(body.csatScore !== undefined ? { csatScore: body.csatScore } : {}),
          ...(body.releaseToBot ? { releaseToBot: true } : {}),
        }
      ),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["conversation-messages", vars.conversationId] });
      qc.invalidateQueries({ queryKey: ["metrics", "marketing"] });
    },
  });
}

export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { conversationId: string; botId: string }) => {
      const params = new URLSearchParams({ botId: body.botId });
      return api.delete(
        `/conversations/${encodeURIComponent(body.conversationId)}?${params.toString()}`
      );
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.removeQueries({ queryKey: ["conversation-messages", vars.conversationId] });
      qc.invalidateQueries({ queryKey: ["metrics"] });
    },
  });
}
