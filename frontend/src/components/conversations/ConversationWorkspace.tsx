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
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Textarea } from "@/components/ui/Input";
import { useFormatters } from "@/hooks/useFormatters";
import { useT, useLocale } from "@/i18n/context";
import { buildWaMeLink, normalizeWhatsAppPhone } from "@/lib/wa-link";
import {
  MessageSquare,
  Send,
  ChevronLeft,
  FileText,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkflowStatus, Channel } from "@/types";
import { useActiveLeadByPhone, useConvertLead } from "@/hooks/useLeads";
import Link from "next/link";
import { AdvisorCallPanel } from "@/components/conversations/AdvisorCallPanel";
import { WhatsAppSoftphone } from "@/components/conversations/WhatsAppSoftphone";
import { ConversationContactPanel } from "@/components/conversations/ConversationContactPanel";
import { ConversationListSidebar } from "@/components/conversations/ConversationListSidebar";
import { ConversationMessageThread } from "@/components/conversations/ConversationMessageThread";
import { ConversationHeaderMenu } from "@/components/conversations/ConversationHeaderMenu";
import { ChannelAvatar } from "@/components/conversations/conversation-ui";
import { MacroPicker } from "@/components/conversations/MacroPicker";
import { AdvisorCopilotPanel } from "@/components/conversations/AdvisorCopilotPanel";
import { QuotationDrawer } from "@/components/conversations/QuotationDrawer";
import { OpportunityDrawer } from "@/components/sales/OpportunityDrawer";
import { useOpportunityByConversation } from "@/hooks/useSalesOpportunity";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useInboxSlaSettings } from "@/hooks/useInboxSla";
import { useWhatsAppRisk } from "@/hooks/useWhatsAppRisk";
import {
  formatElapsedDuration,
  getConversationSlaStatus,
  getElapsedSecondsSinceHandoff,
  resolveInboxSlaSettings,
} from "@/lib/inbox-sla";
import type { InboxSlaStatus } from "@/types";

function matchesSearchQuery(
  conv: { contactName?: string; phoneNumber: string; participantId?: string; emailSubject?: string },
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const fields = [
    conv.contactName,
    conv.phoneNumber,
    conv.participantId,
    conv.emailSubject,
  ].filter(Boolean);
  return fields.some((field) => field!.toLowerCase().includes(q));
}

type ListTab = "all" | "unread" | "mine" | "sla_breached" | "queue";

type Props = {
  advisorMode?: boolean;
};

export function ConversationWorkspace({ advisorMode = false }: Props) {
  const t = useT();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const { formatRelativeTime } = useFormatters();
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
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);
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
  const [searchQuery, setSearchQuery] = useState("");

  const { data: bots } = useBots();
  const { data: advisors } = useAdvisors();
  const { data: inboxSlaSettings } = useInboxSlaSettings();
  const { data: whatsappRisk } = useWhatsAppRisk();
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
  const conversations = useMemo(
    () => conversationsData?.pages.flatMap((page) => page.items).filter((c) => c != null) ?? [],
    [conversationsData?.pages]
  );

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
    if (!matchesSearchQuery(conv, searchQuery)) return false;
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
  const selectedContactPhone =
    selectedConversation?.phoneNumber || selectedConversation?.participantId;
  const { data: activeLead } = useActiveLeadByPhone(selectedContactPhone);
  const { data: activeOpportunity } = useOpportunityByConversation(
    selectedConversation?.conversationId
  );
  const convertLead = useConvertLead();
  const selectedBot = bots?.find((b) => b.botId === selectedConversation?.botId);
  const isImapReadOnly =
    selectedConversation?.channel === "email" && selectedBot?.emailInboundProvider === "imap";
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
    if (channel === "voicebot") return t("conversations.channelVoicebot");
    if (channel === "phone") return t("conversations.channelPhone");
    return t("conversations.channelWhatsapp");
  }

  function contactDisplay(conv: { contactName?: string; phoneNumber: string; participantId?: string; channel?: Channel }) {
    if (conv.contactName) return conv.contactName;
    if (
      (conv.channel ?? "whatsapp") === "whatsapp" ||
      conv.channel === "sms" ||
      conv.channel === "phone"
    ) {
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
  const canCompose = isHuman && !!selectedConversation && !needsClaim && !isImapReadOnly;
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
      <ConversationListSidebar
        advisorMode={advisorMode}
        listTab={listTab}
        onListTabChange={setListTab}
        unreadCount={unreadCount}
        slaBreachedCount={slaBreachedCount}
        slaEnabled={resolvedSlaSettings.enabled}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        botFilter={botFilter}
        onBotFilterChange={setBotFilter}
        channelFilter={channelFilter}
        onChannelFilterChange={setChannelFilter}
        handoffFilter={handoffFilter}
        onHandoffFilterChange={setHandoffFilter}
        workflowFilter={workflowFilter}
        onWorkflowFilterChange={setWorkflowFilter}
        advisorFilter={advisorFilter}
        onAdvisorFilterChange={setAdvisorFilter}
        assignmentFilter={assignmentFilter}
        onAssignmentFilterChange={setAssignmentFilter}
        bots={bots}
        advisors={advisors}
        conversations={conversations}
        filteredConversations={filteredConversations}
        conversationSlaStatuses={conversationSlaStatuses}
        selectedId={selectedId}
        onSelectId={setSelectedId}
        selectedConversationIds={selectedConversationIds}
        onToggleSelection={toggleConversationSelection}
        onToggleSelectAll={toggleSelectAll}
        onBulkReassign={() => setShowBulkReassignModal(true)}
        isLoading={isLoading}
        isFetchingNextPage={isFetchingNextPage}
        listScrollRef={listScrollRef}
        loadMoreRef={loadMoreRef}
        formatRelativeTime={formatRelativeTime}
        contactDisplay={contactDisplay}
        channelLabel={channelLabel}
        workflowLabel={workflowLabel}
        slaLabel={slaLabel}
        formatElapsed={formatElapsedDuration}
        getElapsedSeconds={getElapsedSecondsSinceHandoff}
        onClaimFromQueue={async (conv) => {
          setSelectedId(conv.conversationId);
          await claim.mutateAsync({
            conversationId: conv.conversationId,
            botId: conv.botId,
          });
          setListTab("mine");
        }}
        claimPending={claim.isPending}
        showOnMobile={showListOnMobile}
        whatsappRisk={whatsappRisk}
      />

      <div
        className={cn(
          "relative flex min-w-0 flex-1 flex-col",
          showDetailOnMobile ? "flex" : "hidden lg:flex"
        )}
      >
        {!selectedConversation ? (
          <div className="conversations-chat-bg hidden flex-1 items-center justify-center p-6 lg:flex">
            <EmptyState
              icon={<MessageSquare className="h-6 w-6" />}
              title={t("conversations.selectConversation")}
              description={t("conversations.selectDescription")}
            />
          </div>
        ) : (
          <>
            <div className="conversations-chat-header relative z-30 flex min-h-[64px] flex-col gap-3 overflow-visible px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="rounded-xl p-2 text-secondary transition-colors hover:bg-surface-muted lg:hidden"
                  aria-label={t("conversations.backToList")}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <ChannelAvatar channel={selectedConversation.channel} size="md" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-base font-semibold text-primary">
                      {selectedConversation.channel === "email" && selectedConversation.emailSubject
                        ? selectedConversation.emailSubject
                        : contactDisplay(selectedConversation)}
                    </p>
                    {activeLead?.tags?.slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="default" className="text-[10px]">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <p className="truncate text-xs text-secondary">
                    {channelLabel(selectedConversation.channel)}
                    {" · "}
                    {(selectedConversation.channel ?? "whatsapp") === "whatsapp" ||
                    selectedConversation.channel === "sms" ||
                    selectedConversation.channel === "phone"
                      ? selectedConversation.phoneNumber || selectedConversation.participantId
                      : selectedConversation.channel === "email"
                        ? selectedConversation.participantId
                        : selectedConversation.participantId}
                  </p>
                </div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <ConversationHeaderMenu
                  conversation={selectedConversation}
                  advisorMode={advisorMode}
                  isHuman={isHuman}
                  needsClaim={needsClaim}
                  claimPending={claim.isPending}
                  releasePending={release.isPending}
                  callPermissionPending={callPermission.isPending}
                  canRequestCallPermission={
                    !advisorMode &&
                    Boolean(selectedConversation.botId) &&
                    (selectedConversation.channel ?? "whatsapp") === "whatsapp"
                  }
                  callPermissionDisabled={
                    callPermission.isPending || selectedWhatsAppPhone.length < 7
                  }
                  onClaim={handleClaim}
                  onDelete={() => setShowDeleteModal(true)}
                  onTransfer={() => setShowHandoffModal(true)}
                  onRequestCallPermission={() => {
                    setCallPermissionFeedback(null);
                    callPermission.mutate({
                      botId: selectedConversation.botId,
                      to: selectedConversation.phoneNumber,
                    });
                  }}
                  onResolve={() => {
                    setInternalNote(selectedConversation.internalNote ?? "");
                    setShowResolveModal(true);
                  }}
                  onOpenWhatsApp={
                    isHuman && (selectedConversation.channel ?? "whatsapp") === "whatsapp"
                      ? buildWaMeLink(selectedConversation.phoneNumber)
                      : null
                  }
                  onRelease={handleRelease}
                />
              </div>
            </div>

            {callPermissionFeedback ? (
              <p
                className={cn(
                  "border-b px-4 py-2 text-xs font-medium sm:px-6",
                  callPermissionFeedback.type === "success"
                    ? "border-success/30 bg-success/10 text-success"
                    : "border-danger/30 bg-danger/10 text-danger"
                )}
              >
                {callPermissionFeedback.message}
              </p>
            ) : null}

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
                      ? "border-danger/30 bg-danger/10 text-danger"
                      : "border-warning/30 bg-warning/10 text-warning"
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
            {isHuman && (selectedConversation.channel ?? "whatsapp") !== "whatsapp" && !isImapReadOnly && (
              <p className="border-b border-default border-l-4 border-l-accent bg-surface-muted px-6 py-2.5 text-xs font-medium text-primary">
                {t("conversations.replyViaChannel", {
                  channel: channelLabel(selectedConversation.channel),
                })}
              </p>
            )}
            {isImapReadOnly && (
              <p className="border-b border-default border-l-4 border-l-warning bg-warning/10 px-6 py-2.5 text-xs font-medium text-primary">
                {t("emailChannel.imapReadOnly")}
              </p>
            )}

            {selectedConversation && activeOpportunity && (
              <div className="relative z-10 mx-4 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-accent/30 bg-accent-muted/20 p-3 text-sm text-primary shadow-sm">
                <div>
                  <span className="font-semibold">{t("sales.title")}: </span>
                  <span>{activeOpportunity.title}</span>
                  <span className="ml-2 text-xs text-secondary">({activeOpportunity.stage})</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedOpportunityId(activeOpportunity.opportunityId)}
                  className="text-xs font-medium text-accent hover:text-accent"
                >
                  {t("sales.openOpportunity")}
                </button>
              </div>
            )}

            {selectedConversation && activeLead && (
              <div className="relative z-10 mx-4 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-warning/30 bg-warning/10 p-3 text-sm text-primary shadow-sm">
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
              <div className="relative z-10 border-b border-default px-4 py-3 sm:px-6">
                <div className="conversations-internal-note space-y-2 p-4">
                  <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                    <Lock className="h-3.5 w-3.5" />
                    {t("conversations.internalNote")}
                  </label>
                  <Textarea
                    value={internalNote || selectedConversation.internalNote || ""}
                    onChange={(e) => setInternalNote(e.target.value)}
                    rows={2}
                    className="border-none bg-transparent shadow-none focus:ring-0"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleSaveNote}
                    disabled={updateNote.isPending}
                    className="text-accent hover:text-accent-hover"
                  >
                    {t("conversations.saveNote")}
                  </Button>
                </div>
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
              <ConversationMessageThread
                messages={messages}
                conversation={selectedConversation}
                loading={loadingMessages}
                loadingLabel={t("common.loading")}
              />
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
                className="conversations-compose-bar relative z-10 px-4 py-3 sm:px-6"
              >
                <div className="conversations-compose-input flex items-end gap-2 px-3 py-2">
                  {selectedConversation ? (
                    <MacroPicker
                      botId={selectedConversation.botId}
                      placeholderContext={macroPlaceholderContext}
                      draft={draft}
                      onInsert={setDraft}
                    />
                  ) : null}
                  {selectedConversation && canCompose ? (
                    <button
                      type="button"
                      onClick={() => setShowQuotationDrawer(true)}
                      title={t("quotations.drawerTitle")}
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-secondary transition-colors hover:bg-surface-elevated hover:text-primary"
                    >
                      <FileText className="h-5 w-5" />
                    </button>
                  ) : null}
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={1}
                    placeholder={t("conversations.messagePlaceholderShort")}
                    className="min-h-[42px] max-h-32 flex-1 resize-none border-0 bg-transparent py-2.5 shadow-none focus:ring-0"
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim() || sendMessage.isPending}
                    className="conversations-send-btn inline-flex h-10 flex-shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed"
                  >
                    <Send className="h-4 w-4" />
                    <span className="hidden sm:inline">{t("conversations.send")}</span>
                  </button>
                </div>
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
          locale={locale}
          onOpenOpportunity={setSelectedOpportunityId}
          whatsappRisk={whatsappRisk}
        />
      )}

      {selectedOpportunityId ? (
        <OpportunityDrawer
          opportunityId={selectedOpportunityId}
          locale={locale}
          onClose={() => setSelectedOpportunityId(null)}
        />
      ) : null}

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
        <ConfirmDialog
          open={showDeleteModal}
          title={t("conversations.deleteTitle")}
          description={t("conversations.deleteConfirm")}
          confirmLabel={t("conversations.delete")}
          tone="danger"
          loading={deleteConv.isPending}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
        />
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
