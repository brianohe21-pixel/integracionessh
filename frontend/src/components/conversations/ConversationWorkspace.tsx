"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  useConversations,
  useConversationMessages,
  useHandoffConversation,
  useBulkHandoffConversation,
  useClaimConversation,
  useReleaseConversation,
  useSendConversationMessage,
  useUpdateConversationNote,
  useResolveConversation,
  useDeleteConversation,
} from "@/hooks/useConversations";
import { useAdvisors } from "@/hooks/useAdvisors";
import { useBots } from "@/hooks/useBots";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Input";
import { Tabs } from "@/components/ui/Tabs";
import { Textarea } from "@/components/ui/Input";
import { useFormatters } from "@/hooks/useFormatters";
import { useT } from "@/i18n/context";
import { buildWaMeLink, normalizeWhatsAppPhone } from "@/lib/wa-link";
import {
  MessageSquare,
  User,
  Bot,
  Phone,
  Headphones,
  Send,
  ExternalLink,
  ChevronLeft,
  Trash2,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message, WorkflowStatus, Channel } from "@/types";
import { useActiveLeadByPhone, useConvertLead } from "@/hooks/useLeads";
import Link from "next/link";
import { AdvisorCallPanel } from "@/components/conversations/AdvisorCallPanel";
import { WhatsAppSoftphone } from "@/components/conversations/WhatsAppSoftphone";
import { ConversationContactPanel } from "@/components/conversations/ConversationContactPanel";
import { MacroPicker } from "@/components/conversations/MacroPicker";
import { AdvisorCopilotPanel } from "@/components/conversations/AdvisorCopilotPanel";
import { QuotationDrawer } from "@/components/conversations/QuotationDrawer";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useInboxSlaSettings } from "@/hooks/useInboxSla";
import {
  formatElapsedDuration,
  getConversationSlaStatus,
  getElapsedSecondsSinceHandoff,
  resolveInboxSlaSettings,
} from "@/lib/inbox-sla";
import type { InboxSlaStatus } from "@/types";

function messageListKey(msg: Message, index: number): string {
  return `${msg.messageId}::${msg.timestamp}::${index}`;
}

type ListTab = "all" | "unread" | "mine" | "sla_breached" | "queue";

type Props = {
  advisorMode?: boolean;
};

export function ConversationWorkspace({ advisorMode = false }: Props) {
  const t = useT();
  const searchParams = useSearchParams();
  const { formatRelativeTime, formatDate } = useFormatters();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [botFilter, setBotFilter] = useState<string>("");
  const [handoffFilter, setHandoffFilter] = useState<"" | "human" | "bot">("");
  const [channelFilter, setChannelFilter] = useState<"" | Channel>("");
  const [workflowFilter, setWorkflowFilter] = useState<"" | WorkflowStatus>("");
  const [advisorFilter, setAdvisorFilter] = useState("");
  const [assignmentFilter, setAssignmentFilter] = useState<"" | "unassigned">("");
  const [draft, setDraft] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [showQuotationDrawer, setShowQuotationDrawer] = useState(false);
  const [showHandoffModal, setShowHandoffModal] = useState(false);
  const [showBulkReassignModal, setShowBulkReassignModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [csatScore, setCsatScore] = useState<number | "">("");
  const [callPermissionFeedback, setCallPermissionFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [selectedAdvisorId, setSelectedAdvisorId] = useState("");
  const [bulkReassignAdvisorId, setBulkReassignAdvisorId] = useState("");
  const [selectedConversationIds, setSelectedConversationIds] = useState<Set<string>>(new Set());
  const [listTab, setListTab] = useState<ListTab>("all");

  const { data: bots } = useBots();
  const { data: advisors } = useAdvisors();
  const { data: inboxSlaSettings } = useInboxSlaSettings();
  const resolvedSlaSettings = useMemo(
    () => resolveInboxSlaSettings(inboxSlaSettings),
    [inboxSlaSettings]
  );
  const { user: currentUser } = useCurrentUser();

  useEffect(() => {
    const assignment = searchParams.get("assignment");
    const assignedAdvisorId = searchParams.get("assignedAdvisorId");
    const handoffMode = searchParams.get("handoffMode");
    if (assignment === "unassigned") {
      setAssignmentFilter("unassigned");
      setHandoffFilter("human");
    }
    if (assignedAdvisorId) {
      setAdvisorFilter(assignedAdvisorId);
      setHandoffFilter("human");
    }
    if (handoffMode === "human" || handoffMode === "bot") {
      setHandoffFilter(handoffMode);
    }
  }, [searchParams]);

  const conversationQueryOptions = useMemo(() => {
    const base = {
      botId: botFilter || undefined,
      channel: channelFilter || undefined,
      workflowStatus: workflowFilter || undefined,
    };

    if (advisorMode && listTab === "queue") {
      return {
        ...base,
        handoffMode: "human" as const,
        assignment: "unassigned" as const,
      };
    }

    if (!advisorMode && assignmentFilter === "unassigned") {
      return {
        ...base,
        handoffMode: "human" as const,
        assignment: "unassigned" as const,
      };
    }

    return {
      ...base,
      handoffMode: handoffFilter || undefined,
      assignedAdvisorId: advisorFilter || undefined,
    };
  }, [
    advisorMode,
    listTab,
    assignmentFilter,
    botFilter,
    channelFilter,
    workflowFilter,
    handoffFilter,
    advisorFilter,
  ]);

  const {
    data: conversationsData,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useConversations(conversationQueryOptions);
  const conversations =
    conversationsData?.pages.flatMap((page) => page.items).filter((c) => c != null) ?? [];

  const conversationSlaStatuses = useMemo(
    () =>
      new Map(
        conversations.map((conv) => [
          conv.conversationId,
          getConversationSlaStatus(conv, resolvedSlaSettings),
        ])
      ),
    [conversations, resolvedSlaSettings]
  );

  const filteredConversations = conversations.filter((conv) => {
    if (advisorMode && listTab === "queue") return true;
    if (listTab === "unread") return conv.workflowStatus === "new";
    if (listTab === "mine") return (conv.handoffMode ?? "bot") === "human";
    if (listTab === "sla_breached") {
      return conversationSlaStatuses.get(conv.conversationId) === "breached";
    }
    return true;
  });

  const unreadCount = conversations.filter((c) => c.workflowStatus === "new").length;
  const slaBreachedCount = conversations.filter(
    (c) => conversationSlaStatuses.get(c.conversationId) === "breached"
  ).length;
  const listScrollRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const selectedConversationPreview = conversations.find((c) => c.conversationId === selectedId);
  const messagesEnabled = !(
    advisorMode &&
    selectedConversationPreview &&
    (selectedConversationPreview.handoffMode ?? "bot") === "human" &&
    !selectedConversationPreview.assignedAdvisorId
  );
  const { data: messages, isLoading: loadingMessages } = useConversationMessages(
    selectedId ?? "",
    messagesEnabled
  );

  useEffect(() => {
    const root = listScrollRef.current;
    const target = loadMoreRef.current;
    if (!root || !target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { root, threshold: 0.1 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, conversations.length]);

  const handoff = useHandoffConversation();
  const bulkHandoff = useBulkHandoffConversation();
  const claim = useClaimConversation();
  const callPermission = useMutation({
    mutationFn: (params: { botId: string; to: string }) =>
      api.post(`/bots/${params.botId}/calling/calls/permission-request`, {
        to: normalizeWhatsAppPhone(params.to),
      }),
    onSuccess: () => {
      setCallPermissionFeedback({
        type: "success",
        message: t("conversations.callPermissionSent"),
      });
    },
    onError: (err: Error) => {
      setCallPermissionFeedback({
        type: "error",
        message: err.message || t("conversations.callPermissionFailed"),
      });
    },
  });
  const release = useReleaseConversation();
  const sendMessage = useSendConversationMessage();
  const updateNote = useUpdateConversationNote();
  const resolveConv = useResolveConversation();
  const deleteConv = useDeleteConversation();

  const selectedConversation = conversations.find((c) => c.conversationId === selectedId);
  const { data: activeLead } = useActiveLeadByPhone(selectedConversation?.phoneNumber);
  const convertLead = useConvertLead();
  const selectedBot = bots?.find((b) => b.botId === selectedConversation?.botId);
  const selectedWhatsAppPhone = selectedConversation
    ? normalizeWhatsAppPhone(selectedConversation.phoneNumber)
    : "";

  useEffect(() => {
    setCallPermissionFeedback(null);
  }, [selectedId]);

  function channelLabel(channel?: Channel): string {
    if (channel === "instagram") return t("conversations.channelInstagram");
    if (channel === "webchat") return t("conversations.channelWebchat");
    if (channel === "telegram") return t("conversations.channelTelegram");
    if (channel === "messenger") return t("conversations.channelMessenger");
    if (channel === "sms") return t("conversations.channelSms");
    if (channel === "email") return t("conversations.channelEmail");
    return t("conversations.channelWhatsapp");
  }

  function contactDisplay(conv: { contactName?: string; phoneNumber: string; participantId?: string; channel?: Channel }) {
    if (conv.contactName) return conv.contactName;
    if ((conv.channel ?? "whatsapp") === "whatsapp" || conv.channel === "sms") {
      return conv.phoneNumber || conv.participantId;
    }
    return conv.participantId ?? conv.phoneNumber;
  }

  function workflowLabel(status?: WorkflowStatus): string {
    const key = status ?? "open";
    const map: Record<WorkflowStatus, string> = {
      new: t("conversations.workflowNew"),
      open: t("conversations.workflowOpen"),
      pending: t("conversations.workflowPending"),
      resolved: t("conversations.workflowResolved"),
    };
    return map[key] ?? map.open;
  }
  const isHuman = (selectedConversation?.handoffMode ?? "bot") === "human";
  const needsClaim =
    advisorMode &&
    !!selectedConversation &&
    isHuman &&
    !selectedConversation.assignedAdvisorId;
  const canCompose = isHuman && !!selectedConversation && !needsClaim;
  const assignedAdvisor = advisors?.find(
    (a) => a.advisorId === selectedConversation?.assignedAdvisorId
  );
  const macroPlaceholderContext = {
    contactName: selectedConversation ? contactDisplay(selectedConversation) : undefined,
    phoneNumber: selectedConversation?.phoneNumber,
    advisorName: assignedAdvisor?.name ?? (advisorMode ? currentUser?.name : undefined),
  };

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedConversation || !draft.trim()) return;
    await sendMessage.mutateAsync({
      conversationId: selectedConversation.conversationId,
      botId: selectedConversation.botId,
      content: draft.trim(),
    });
    setDraft("");
  }

  async function handleHandoff() {
    if (!selectedConversation) return;
    await handoff.mutateAsync({
      conversationId: selectedConversation.conversationId,
      botId: selectedConversation.botId,
      ...(selectedAdvisorId ? { advisorId: selectedAdvisorId } : {}),
    });
    setShowHandoffModal(false);
    setSelectedAdvisorId("");
  }

  async function handleBulkReassign() {
    const items = filteredConversations
      .filter((conv) => selectedConversationIds.has(conv.conversationId))
      .map((conv) => ({ conversationId: conv.conversationId, botId: conv.botId }));
    if (items.length === 0) return;

    const result = await bulkHandoff.mutateAsync({
      items,
      ...(bulkReassignAdvisorId ? { advisorId: bulkReassignAdvisorId } : {}),
    });

    setShowBulkReassignModal(false);
    setBulkReassignAdvisorId("");
    setSelectedConversationIds(new Set());

    if (result.failed.length === 0) {
      window.alert(t("conversations.bulkReassignSuccess", { count: result.succeeded.length }));
    } else {
      window.alert(
        t("conversations.bulkReassignPartial", {
          succeeded: result.succeeded.length,
          failed: result.failed.length,
        })
      );
    }
  }

  async function handleClaim() {
    if (!selectedConversation) return;
    await claim.mutateAsync({
      conversationId: selectedConversation.conversationId,
      botId: selectedConversation.botId,
    });
    if (advisorMode) setListTab("mine");
  }

  function toggleConversationSelection(conversationId: string) {
    setSelectedConversationIds((prev) => {
      const next = new Set(prev);
      if (next.has(conversationId)) next.delete(conversationId);
      else next.add(conversationId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedConversationIds.size === filteredConversations.length) {
      setSelectedConversationIds(new Set());
      return;
    }
    setSelectedConversationIds(new Set(filteredConversations.map((c) => c.conversationId)));
  }

  async function handleRelease() {
    if (!selectedConversation) return;
    await release.mutateAsync({
      conversationId: selectedConversation.conversationId,
      botId: selectedConversation.botId,
    });
  }

  async function handleSaveNote() {
    if (!selectedConversation || !internalNote.trim()) return;
    await updateNote.mutateAsync({
      conversationId: selectedConversation.conversationId,
      botId: selectedConversation.botId,
      internalNote: internalNote.trim(),
    });
  }

  async function handleResolve() {
    if (!selectedConversation) return;
    await resolveConv.mutateAsync({
      conversationId: selectedConversation.conversationId,
      botId: selectedConversation.botId,
      ...(csatScore !== "" ? { csatScore: Number(csatScore) } : {}),
    });
    setShowResolveModal(false);
    setCsatScore("");
    setSelectedId(null);
  }

  async function handleDelete() {
    if (!selectedConversation) return;
    await deleteConv.mutateAsync({
      conversationId: selectedConversation.conversationId,
      botId: selectedConversation.botId,
    });
    setShowDeleteModal(false);
    setSelectedId(null);
  }

  function slaLabel(status: InboxSlaStatus): string | null {
    if (status === "breached") return t("conversations.slaBreached");
    if (status === "at_risk") return t("conversations.slaAtRisk");
    return null;
  }

  function slaBadgeVariant(status: InboxSlaStatus): "danger" | "warning" | "default" {
    if (status === "breached") return "danger";
    if (status === "at_risk") return "warning";
    return "default";
  }

  const selectedSlaStatus = selectedConversation
    ? conversationSlaStatuses.get(selectedConversation.conversationId) ?? "disabled"
    : "disabled";
  const selectedElapsedSeconds = selectedConversation?.handoffAt
    ? getElapsedSecondsSinceHandoff(selectedConversation.handoffAt)
    : null;

  const showListOnMobile = !selectedId;
  const showDetailOnMobile = Boolean(selectedId);

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] lg:h-screen">
      <div
        className={cn(
          "flex w-full flex-col border-r border-default bg-surface-elevated lg:w-80 lg:flex-shrink-0",
          showListOnMobile ? "flex" : "hidden lg:flex"
        )}
      >
        <div className="space-y-3 border-b border-default p-4">
          <h1 className="font-bold text-primary">
            {advisorMode ? t("inbox.title") : t("conversations.title")}
          </h1>
          <Tabs<ListTab>
            items={[
              { id: "all", label: t("conversations.filterTabAll") },
              { id: "unread", label: t("conversations.filterTabUnread"), count: unreadCount },
              { id: "mine", label: t("conversations.filterTabMine") },
              ...(advisorMode
                ? ([{ id: "queue" as const, label: t("conversations.filterTabQueue") }] as const)
                : []),
              ...(resolvedSlaSettings.enabled
                ? ([
                    {
                      id: "sla_breached" as const,
                      label: t("conversations.filterTabSlaBreached"),
                      count: slaBreachedCount,
                    },
                  ] as const)
                : []),
            ]}
            value={listTab}
            onChange={setListTab}
          />
          {!advisorMode && (
            <Select value={botFilter} onChange={(e) => setBotFilter(e.target.value)}>
              <option value="">{t("conversations.allBots")}</option>
              {bots?.map((bot) => (
                <option key={bot.botId} value={bot.botId}>
                  {bot.name}
                </option>
              ))}
            </Select>
          )}
          <Select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value as "" | Channel)}
          >
            <option value="">{t("conversations.filterChannelAll")}</option>
            <option value="whatsapp">{t("conversations.channelWhatsapp")}</option>
            <option value="instagram">{t("conversations.channelInstagram")}</option>
            <option value="webchat">{t("conversations.channelWebchat")}</option>
            <option value="telegram">{t("conversations.channelTelegram")}</option>
            <option value="messenger">{t("conversations.channelMessenger")}</option>
            <option value="sms">{t("conversations.channelSms")}</option>
            <option value="email">{t("conversations.channelEmail")}</option>
          </Select>
          <Select
            value={handoffFilter}
            onChange={(e) => setHandoffFilter(e.target.value as "" | "human" | "bot")}
          >
            <option value="">{t("conversations.filterAll")}</option>
            <option value="human">{t("conversations.filterHuman")}</option>
            <option value="bot">{t("conversations.filterBot")}</option>
          </Select>
          {handoffFilter === "human" && (
            <Select
              value={workflowFilter}
              onChange={(e) => setWorkflowFilter(e.target.value as "" | WorkflowStatus)}
            >
              <option value="">{t("conversations.filterWorkflowAll")}</option>
              <option value="new">{t("conversations.filterWorkflowNew")}</option>
              <option value="open">{t("conversations.filterWorkflowOpen")}</option>
              <option value="pending">{t("conversations.filterWorkflowPending")}</option>
              <option value="resolved">{t("conversations.filterWorkflowResolved")}</option>
            </Select>
          )}
          {!advisorMode && (
            <Select value={advisorFilter} onChange={(e) => setAdvisorFilter(e.target.value)}>
              <option value="">{t("conversations.filterAdvisorAll")}</option>
              {advisors
                ?.filter((a) => a.status === "active")
                .map((a) => (
                  <option key={a.advisorId} value={a.advisorId}>
                    {a.name}
                  </option>
                ))}
            </Select>
          )}
          {!advisorMode && (
            <Select
              value={assignmentFilter}
              onChange={(e) => setAssignmentFilter(e.target.value as "" | "unassigned")}
            >
              <option value="">{t("conversations.filterAll")}</option>
              <option value="unassigned">{t("conversations.filterUnassigned")}</option>
            </Select>
          )}
          {!advisorMode && filteredConversations.length > 0 && (
            <label className="flex items-center gap-2 text-xs text-secondary">
              <input
                type="checkbox"
                checked={
                  filteredConversations.length > 0 &&
                  selectedConversationIds.size === filteredConversations.length
                }
                onChange={toggleSelectAll}
                className="rounded border-default"
              />
              {t("conversations.selectAll")}
            </label>
          )}
        </div>

        {!advisorMode && selectedConversationIds.size > 0 && (
          <div className="flex items-center justify-between gap-2 border-b border-default bg-accent-muted px-4 py-2">
            <span className="text-xs font-medium text-primary">
              {t("conversations.bulkSelected", { count: selectedConversationIds.size })}
            </span>
            <Button type="button" size="sm" onClick={() => setShowBulkReassignModal(true)}>
              {t("conversations.bulkReassign")}
            </Button>
          </div>
        )}

        <div ref={listScrollRef} className="flex-1 overflow-y-auto">
          {isLoading && <p className="p-4 text-sm text-muted">{t("common.loading")}</p>}

          {!isLoading && filteredConversations.length === 0 && (
            <EmptyState
              icon={<MessageSquare className="w-5 h-5" />}
              title={t("conversations.emptyTitle")}
              description={t("conversations.emptyDescription")}
              className="py-12"
            />
          )}

          {filteredConversations.map((conv) => {
            const slaStatus = conversationSlaStatuses.get(conv.conversationId) ?? "disabled";
            const slaText = slaLabel(slaStatus);
            const elapsedSeconds =
              (conv.handoffMode ?? "bot") === "human" && conv.handoffAt && !conv.firstHumanResponseAt
                ? getElapsedSecondsSinceHandoff(conv.handoffAt)
                : null;

            return (
            <div
              key={conv.conversationId}
              className={cn(
                "flex w-full border-b border-subtle transition-colors hover:bg-surface-muted",
                selectedId === conv.conversationId &&
                  "border-l-2 border-l-accent bg-accent-muted",
                slaStatus === "breached" && "border-l-2 border-l-red-500",
                slaStatus === "at_risk" && "border-l-2 border-l-amber-500"
              )}
            >
              {!advisorMode && (
                <div className="flex items-center px-2">
                  <input
                    type="checkbox"
                    checked={selectedConversationIds.has(conv.conversationId)}
                    onChange={() => toggleConversationSelection(conv.conversationId)}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded border-default"
                  />
                </div>
              )}
              <button
              type="button"
              onClick={() => setSelectedId(conv.conversationId)}
              className="min-w-0 flex-1 px-4 py-3 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-surface-muted">
                  <User className="h-4 w-4 text-muted" />
                  {conv.workflowStatus === "new" && (
                    <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-surface-elevated" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-center justify-between">
                    <p className="truncate text-sm font-medium text-primary">
                      {contactDisplay(conv)}
                    </p>
                    <span className="ml-2 flex-shrink-0 text-xs text-muted">
                      {formatRelativeTime(conv.lastMessageAt)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="default" className="text-[10px]">
                      {channelLabel(conv.channel)}
                    </Badge>
                    {conv.locale && (
                      <Badge variant="default" className="text-[10px] uppercase">
                        {conv.locale}
                      </Badge>
                    )}
                    <Badge
                      variant={(conv.handoffMode ?? "bot") === "human" ? "warning" : "default"}
                      className="text-[10px]"
                    >
                      {(conv.handoffMode ?? "bot") === "human"
                        ? t("conversations.modeHuman")
                        : t("conversations.modeBot")}
                    </Badge>
                    {(conv.handoffMode ?? "bot") === "human" && (
                      <Badge variant="info" className="text-[10px]">
                        {workflowLabel(conv.workflowStatus)}
                      </Badge>
                    )}
                    {slaText && (
                      <Badge variant={slaBadgeVariant(slaStatus)} className="text-[10px]">
                        {slaText}
                      </Badge>
                    )}
                    {elapsedSeconds !== null && (
                      <span className="text-[10px] text-muted">
                        {t("conversations.slaElapsed", {
                          duration: formatElapsedDuration(elapsedSeconds),
                        })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
            {advisorMode && listTab === "queue" && (
              <div className="flex items-center px-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={async (e) => {
                    e.stopPropagation();
                    setSelectedId(conv.conversationId);
                    await claim.mutateAsync({
                      conversationId: conv.conversationId,
                      botId: conv.botId,
                    });
                    setListTab("mine");
                  }}
                  disabled={claim.isPending}
                >
                  {t("conversations.takeConversation")}
                </Button>
              </div>
            )}
            </div>
            );
          })}

          <div ref={loadMoreRef} className="h-1" />
          {isFetchingNextPage && (
            <p className="p-4 text-center text-sm text-muted">{t("common.loading")}</p>
          )}
        </div>
      </div>

      <div
        className={cn(
          "relative flex min-w-0 flex-1 flex-col bg-surface",
          showDetailOnMobile ? "flex" : "hidden lg:flex"
        )}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[var(--glow-accent)] to-transparent"
          aria-hidden
        />
        {!selectedConversation ? (
          <div className="hidden flex-1 items-center justify-center lg:flex">
            <EmptyState
              icon={<MessageSquare className="w-6 h-6" />}
              title={t("conversations.selectConversation")}
              description={t("conversations.selectDescription")}
            />
          </div>
        ) : (
          <>
            <div className="relative z-10 flex flex-col gap-3 border-b border-default bg-surface-elevated px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="rounded-lg border border-default p-2 text-secondary hover:bg-surface-muted lg:hidden"
                  aria-label={t("conversations.backToList")}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-muted">
                  <User className="h-4 w-4 text-muted" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-primary">
                    {contactDisplay(selectedConversation)}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-secondary">
                    <Badge variant="accent" className="text-[10px]">
                      {channelLabel(selectedConversation.channel)}
                    </Badge>
                    {selectedConversation.locale && (
                      <Badge variant="default" className="text-[10px] uppercase">
                        {t("conversations.detectedLocale", { locale: selectedConversation.locale.toUpperCase() })}
                      </Badge>
                    )}
                    {(selectedConversation.channel ?? "whatsapp") === "whatsapp" ? (
                      <>
                        <Phone className="h-3 w-3 flex-shrink-0" />
                        {selectedConversation.phoneNumber}
                      </>
                    ) : (
                      <span>{selectedConversation.participantId}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                {needsClaim && (
                  <Button type="button" size="sm" onClick={handleClaim} disabled={claim.isPending}>
                    {t("conversations.takeConversation")}
                  </Button>
                )}
                {!advisorMode && selectedConversation.botId && (
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => setShowDeleteModal(true)}
                    className="gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    {t("conversations.delete")}
                  </Button>
                )}
                {!advisorMode && !isHuman && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setShowHandoffModal(true)}
                    className="bg-warning/15 text-warning hover:bg-warning/25"
                  >
                    {t("conversations.transfer")}
                  </Button>
                )}
                {!advisorMode && selectedConversation.botId && (selectedConversation.channel ?? "whatsapp") === "whatsapp" && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setCallPermissionFeedback(null);
                        callPermission.mutate({
                          botId: selectedConversation.botId,
                          to: selectedConversation.phoneNumber,
                        });
                      }}
                      disabled={callPermission.isPending || selectedWhatsAppPhone.length < 7}
                      className="rounded-lg bg-human/15 px-3 py-1.5 text-xs font-medium text-human hover:bg-human/25 disabled:opacity-50"
                    >
                      {t("conversations.requestCallPermission")}
                    </button>
                    {callPermissionFeedback ? (
                      <p
                        className={cn(
                          "w-full text-xs font-medium",
                          callPermissionFeedback.type === "success"
                            ? "text-success"
                            : "text-danger"
                        )}
                      >
                        {callPermissionFeedback.message}
                      </p>
                    ) : null}
                  </>
                )}
                {isHuman && (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setInternalNote(selectedConversation.internalNote ?? "");
                        setShowResolveModal(true);
                      }}
                    >
                      {t("conversations.resolve")}
                    </Button>
                    {(selectedConversation.channel ?? "whatsapp") === "whatsapp" && (
                      <a
                        href={buildWaMeLink(selectedConversation.phoneNumber)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-success/15 px-3 py-1.5 text-xs font-medium text-success hover:bg-success/25"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {t("conversations.openWhatsApp")}
                      </a>
                    )}
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleRelease}
                      disabled={release.isPending}
                    >
                      {t("conversations.release")}
                    </Button>
                  </>
                )}
              </div>
            </div>

            {isHuman && (selectedConversation.channel ?? "whatsapp") === "whatsapp" && (
              <p className="border-b border-warning/30 bg-warning/10 px-6 py-2.5 text-xs font-medium text-primary">
                {t("conversations.personalChannelHint")}
              </p>
            )}
            {resolvedSlaSettings.enabled &&
              (selectedSlaStatus === "breached" || selectedSlaStatus === "at_risk") &&
              selectedElapsedSeconds !== null && (
                <p
                  className={cn(
                    "border-b px-6 py-2.5 text-xs font-medium",
                    selectedSlaStatus === "breached"
                      ? "border-red-200 bg-red-50 text-red-800"
                      : "border-amber-200 bg-amber-50 text-amber-800"
                  )}
                >
                  {selectedSlaStatus === "breached"
                    ? t("conversations.slaBreachedBanner", {
                        duration: formatElapsedDuration(selectedElapsedSeconds),
                        minutes: resolvedSlaSettings.firstResponseMinutes,
                      })
                    : t("conversations.slaAtRiskBanner", {
                        duration: formatElapsedDuration(selectedElapsedSeconds),
                        minutes: resolvedSlaSettings.firstResponseMinutes,
                      })}
                </p>
              )}
            {isHuman && (selectedConversation.channel ?? "whatsapp") !== "whatsapp" && (
              <p className="border-b border-default border-l-4 border-l-accent bg-surface-muted px-6 py-2.5 text-xs font-medium text-primary">
                {t("conversations.replyViaChannel", {
                  channel: channelLabel(selectedConversation.channel),
                })}
              </p>
            )}

            {selectedConversation && activeLead && (
              <div className="mx-4 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-primary">
                <div>
                  <span className="font-semibold">{t("leads.leadStatus")}: </span>
                  <span>{t(`leads.status_${activeLead.status}`)}</span>
                </div>
                <div className="flex gap-2">
                  <Link href="/leads" className="text-accent hover:text-accent text-xs">
                    {t("leads.viewLead")}
                  </Link>
                  <button
                    type="button"
                    onClick={() => convertLead.mutate({ leadId: activeLead.leadId })}
                    disabled={convertLead.isPending}
                    className="text-xs font-medium text-accent hover:text-accent"
                  >
                    {t("leads.convert")}
                  </button>
                </div>
              </div>
            )}

            {selectedConversation && (
              <>
                <AdvisorCallPanel
                  conversation={selectedConversation}
                  advisorMode={advisorMode}
                  voiceEnabled={selectedBot?.webchatVoiceEnabled}
                />
                <WhatsAppSoftphone conversation={selectedConversation} advisorMode={advisorMode} />
              </>
            )}

            {isHuman && selectedConversation.workflowStatus !== "resolved" && (
              <div className="space-y-2 border-b border-default bg-surface-elevated px-6 py-3">
                <label className="text-xs font-semibold text-primary">
                  {t("conversations.internalNote")}
                </label>
                <Textarea
                  value={internalNote || selectedConversation.internalNote || ""}
                  onChange={(e) => setInternalNote(e.target.value)}
                  rows={2}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSaveNote}
                  disabled={updateNote.isPending}
                  className="text-accent hover:text-accent"
                >
                  {t("conversations.saveNote")}
                </Button>
              </div>
            )}

            {needsClaim ? (
              <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-3 p-6">
                <p className="max-w-sm text-center text-sm text-secondary">
                  {t("conversations.takeConversationHint")}
                </p>
                <Button type="button" onClick={handleClaim} disabled={claim.isPending}>
                  {t("conversations.takeConversation")}
                </Button>
              </div>
            ) : (
            <div className="relative z-10 flex-1 space-y-3 overflow-y-auto p-4 sm:p-6">
              {loadingMessages && <p className="text-sm text-muted">{t("common.loading")}</p>}

              {messages?.map((msg, index) => {
                const listKey = messageListKey(msg, index);
                const isInbound = msg.role === "user";
                const isSystem = msg.role === "system";
                if (isSystem) {
                  return (
                    <p key={listKey} className="py-1 text-center text-xs text-muted">
                      {msg.content}
                    </p>
                  );
                }
                return (
                  <div
                    key={listKey}
                    className={cn("flex items-end gap-2", isInbound ? "justify-start" : "justify-end")}
                  >
                    {isInbound && (
                      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-surface-muted">
                        <User className="h-3.5 w-3.5 text-muted" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed sm:max-w-xs lg:max-w-md",
                        isInbound
                          ? "rounded-bl-sm border border-default bg-surface-elevated text-primary"
                          : msg.role === "advisor"
                            ? "rounded-br-sm bg-success text-white"
                            : "rounded-br-sm border border-accent/30 bg-accent-muted text-primary"
                      )}
                    >
                      <p>{msg.content}</p>
                      <p
                        className={cn(
                          "mt-1 text-[10px]",
                          isInbound ? "text-muted" : msg.role === "advisor" ? "text-white/70" : "text-secondary"
                        )}
                      >
                        {formatDate(msg.timestamp)}
                      </p>
                    </div>
                    {!isInbound && (
                      <div
                        className={cn(
                          "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full",
                          msg.role === "advisor" ? "bg-success/15" : "bg-accent-muted"
                        )}
                      >
                        {msg.role === "advisor" ? (
                          <Headphones className="h-3.5 w-3.5 text-success" />
                        ) : (
                          <Bot className="h-3.5 w-3.5 text-accent" />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            )}

            {canCompose && selectedConversation && (
              <AdvisorCopilotPanel
                conversation={selectedConversation}
                onInsertSuggestion={setDraft}
              />
            )}

            {canCompose && (
              <form
                onSubmit={handleSend}
                className="relative z-10 flex gap-2 border-t border-default bg-surface-elevated p-4"
              >
                {selectedConversation && (
                  <MacroPicker
                    botId={selectedConversation.botId}
                    placeholderContext={macroPlaceholderContext}
                    draft={draft}
                    onInsert={setDraft}
                  />
                )}
                {selectedConversation && canCompose ? (
                  <button
                    type="button"
                    onClick={() => setShowQuotationDrawer(true)}
                    title={t("quotations.drawerTitle")}
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center self-end rounded-lg border border-default text-secondary hover:bg-surface-muted hover:text-primary"
                  >
                    <FileText className="h-4 w-4" />
                  </button>
                ) : null}
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={2}
                  placeholder={t("conversations.messagePlaceholderShort")}
                  className="resize-none flex-1"
                />
                <Button
                  type="submit"
                  disabled={!draft.trim() || sendMessage.isPending}
                  className="h-10 w-10 self-end rounded-full p-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            )}
          </>
        )}
      </div>

      {selectedConversation && (
        <ConversationContactPanel
          conversation={selectedConversation}
          activeLead={activeLead}
          onAssignAdvisor={() => setShowHandoffModal(true)}
          channelLabel={channelLabel}
        />
      )}

      {showResolveModal && selectedConversation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-xl border border-default bg-surface-elevated p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-primary">{t("conversations.resolveTitle")}</h2>
            <label className="block text-sm text-secondary">{t("conversations.csatLabel")}</label>
            <Select
              value={csatScore}
              onChange={(e) => setCsatScore(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">—</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setShowResolveModal(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="button" onClick={handleResolve} disabled={resolveConv.isPending}>
                {t("conversations.resolveConfirm")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && selectedConversation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-xl border border-default bg-surface-elevated p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-primary">{t("conversations.deleteTitle")}</h2>
            <p className="text-sm text-secondary">{t("conversations.deleteConfirm")}</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setShowDeleteModal(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="button" variant="danger" onClick={handleDelete} disabled={deleteConv.isPending}>
                {t("conversations.delete")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showHandoffModal && selectedConversation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-xl border border-default bg-surface-elevated p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-primary">{t("conversations.transfer")}</h2>
            <Select value={selectedAdvisorId} onChange={(e) => setSelectedAdvisorId(e.target.value)}>
              <option value="">{t("conversations.autoAssign")}</option>
              {advisors
                ?.filter((a) => a.status === "active")
                .map((a) => (
                  <option key={a.advisorId} value={a.advisorId}>
                    {a.name}
                  </option>
                ))}
            </Select>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setShowHandoffModal(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="button" onClick={handleHandoff} disabled={handoff.isPending}>
                {t("conversations.transfer")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showBulkReassignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-xl border border-default bg-surface-elevated p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-primary">
              {t("conversations.bulkReassignTitle")}
            </h2>
            <Select
              value={bulkReassignAdvisorId}
              onChange={(e) => setBulkReassignAdvisorId(e.target.value)}
            >
              <option value="">{t("conversations.autoAssign")}</option>
              {advisors
                ?.filter((a) => a.status === "active")
                .map((a) => (
                  <option key={a.advisorId} value={a.advisorId}>
                    {a.name}
                  </option>
                ))}
            </Select>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setShowBulkReassignModal(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="button" onClick={handleBulkReassign} disabled={bulkHandoff.isPending}>
                {t("conversations.bulkReassign")}
              </Button>
            </div>
          </div>
        </div>
      )}
      {showQuotationDrawer && selectedConversation ? (
        <QuotationDrawer
          conversation={selectedConversation}
          open={showQuotationDrawer}
          onClose={() => setShowQuotationDrawer(false)}
        />
      ) : null}
    </div>
  );
}
