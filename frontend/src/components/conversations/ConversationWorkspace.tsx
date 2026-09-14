"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  useConversations,
  useConversationMessages,
  useCrossChannelHistory,
  useHandoffConversation,
  useBulkHandoffConversation,
  useClaimConversation,
  useReleaseConversation,
  useSendConversationMessage,
  useResolveConversation,
  useDeleteConversation,
  useClearConversationMessages,
  useBulkDeleteConversations,
} from "@/hooks/useConversations";
import { useAdvisors } from "@/hooks/useAdvisors";
import { useBots } from "@/hooks/useBots";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ConversationComposeBar } from "@/components/conversations/ConversationComposeBar";
import { useFormatters } from "@/hooks/useFormatters";
import { useT, useLocale } from "@/i18n/context";
import { useDialog } from "@/components/ui/DialogProvider";
import { buildWaMeLink, normalizeWhatsAppPhone } from "@/lib/wa-link";
import {
  MessageSquare,
  ChevronLeft,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkflowStatus, Channel, InteractionCategory } from "@/types";
import { INTERACTION_CATEGORIES } from "@/types";
import { interactionCategoryLabelKey } from "@/lib/interaction-categories";
import {
  isAudioAttachmentFile,
  useSendConversationAttachment,
  validateConversationAttachmentFile,
} from "@/hooks/useConversationAttachments";
import { useActiveLeadByPhone, useConvertLead, useCreateLead } from "@/hooks/useLeads";
import Link from "next/link";
import { AdvisorCallPanel } from "@/components/conversations/AdvisorCallPanel";
import { WhatsAppSoftphone } from "@/components/conversations/WhatsAppSoftphone";
import { ConversationContactPanel } from "@/components/conversations/ConversationContactPanel";
import { ConversationListSidebar } from "@/components/conversations/ConversationListSidebar";
import { ConversationMessageThread } from "@/components/conversations/ConversationMessageThread";
import { ConversationHeaderMenu } from "@/components/conversations/ConversationHeaderMenu";
import { ChannelAvatar } from "@/components/conversations/conversation-ui";
import { AdvisorCopilotPanel } from "@/components/conversations/AdvisorCopilotPanel";
import { QuotationDrawer } from "@/components/conversations/QuotationDrawer";
import { BookingDrawer } from "@/components/conversations/BookingDrawer";
import { useUnreadMessages } from "@/components/notifications/UnreadMessagesProvider";
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
  const { alert } = useDialog();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const { formatRelativeTime } = useFormatters();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [botFilter, setBotFilter] = useState<string>("");
  const [handoffFilter, setHandoffFilter] = useState<"" | "human" | "bot">("");
  const [channelFilter, setChannelFilter] = useState<"" | Channel>("");
  const [whatsappChannelFilter, setWhatsappChannelFilter] = useState("");
  const [workflowFilter, setWorkflowFilter] = useState<"" | WorkflowStatus>("");
  const [categoryFilter, setCategoryFilter] = useState<"" | InteractionCategory>("");
  const [advisorFilter, setAdvisorFilter] = useState("");
  const [assignmentFilter, setAssignmentFilter] = useState<"" | "unassigned">("");
  const [draft, setDraft] = useState("");
  const [showQuotationDrawer, setShowQuotationDrawer] = useState(false);
  const [showBookingDrawer, setShowBookingDrawer] = useState(false);
  const [showHandoffModal, setShowHandoffModal] = useState(false);
  const [showBulkReassignModal, setShowBulkReassignModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [csatScore, setCsatScore] = useState<number | "">("");
  const [resolveCategory, setResolveCategory] = useState<InteractionCategory | "">("");
  const [callPermissionFeedback, setCallPermissionFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [selectedAdvisorId, setSelectedAdvisorId] = useState("");
  const [bulkReassignAdvisorId, setBulkReassignAdvisorId] = useState("");
  const [selectedConversationIds, setSelectedConversationIds] = useState<Set<string>>(new Set());
  const [listTab, setListTab] = useState<ListTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [contactPanelCollapsed, setContactPanelCollapsed] = useState(false);

  const { data: bots } = useBots();
  const { data: advisors } = useAdvisors();
  const { data: inboxSlaSettings } = useInboxSlaSettings();
  const { data: whatsappRisk } = useWhatsAppRisk();
  const resolvedSlaSettings = useMemo(
    () => resolveInboxSlaSettings(inboxSlaSettings),
    [inboxSlaSettings]
  );
  const { user: currentUser } = useCurrentUser();
  const { getUnreadCount, setActiveConversationId, markConversationRead } = useUnreadMessages();

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
      whatsappChannelId: whatsappChannelFilter || undefined,
      workflowStatus: workflowFilter || undefined,
      interactionCategory: categoryFilter || undefined,
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
    whatsappChannelFilter,
    workflowFilter,
    categoryFilter,
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
    if (listTab === "unread") {
      return getUnreadCount(conv.conversationId) > 0 || conv.workflowStatus === "new";
    }
    if (listTab === "mine") return (conv.handoffMode ?? "bot") === "human";
    if (listTab === "sla_breached") {
      return conversationSlaStatuses.get(conv.conversationId) === "breached";
    }
    return true;
  });

  const unreadCount = conversations.filter(
    (c) => getUnreadCount(c.conversationId) > 0 || c.workflowStatus === "new"
  ).length;
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
  const isHumanPreview = (selectedConversationPreview?.handoffMode ?? "bot") === "human";
  const { data: crossChannelMessages, isLoading: loadingCrossChannel } = useCrossChannelHistory(
    selectedId ?? "",
    messagesEnabled && isHumanPreview
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
  const sendAttachment = useSendConversationAttachment();
  const resolveConv = useResolveConversation();
  const deleteConv = useDeleteConversation();
  const clearConv = useClearConversationMessages();
  const bulkDelete = useBulkDeleteConversations();

  const selectedConversation = conversations.find((c) => c.conversationId === selectedId);
  const selectedContactPhone =
    selectedConversation?.phoneNumber || selectedConversation?.participantId;
  const { data: activeLead } = useActiveLeadByPhone(selectedContactPhone);
  const convertLead = useConvertLead();
  const createLead = useCreateLead();

  async function handleCreateLeadFromInbox() {
    if (!selectedConversation || !selectedContactPhone) return;
    try {
      await createLead.mutateAsync({
        botId: selectedConversation.botId,
        conversationId: selectedConversation.conversationId,
        ...(selectedConversation.contactName ? { name: selectedConversation.contactName } : {}),
      });
      await alert({
        title: t("leads.title"),
        message: t("leads.createdFromInbox"),
        tone: "success",
      });
    } catch (err) {
      await alert({
        title: t("leads.title"),
        message: (err as Error).message || t("leads.createFromInboxError"),
        tone: "danger",
      });
    }
  }
  const selectedBot = bots?.find((b) => b.botId === selectedConversation?.botId);
  const isImapReadOnly =
    selectedConversation?.channel === "email" && selectedBot?.emailInboundProvider === "imap";
  const selectedWhatsAppPhone = selectedConversation
    ? normalizeWhatsAppPhone(selectedConversation.phoneNumber)
    : "";

  useEffect(() => {
    setCallPermissionFeedback(null);
  }, [selectedId]);

  useEffect(() => {
    setActiveConversationId(selectedId);
  }, [selectedId, setActiveConversationId]);

  useEffect(() => {
    if (!selectedId || !selectedConversation) return;
    markConversationRead(
      selectedId,
      selectedConversation.botId,
      selectedConversation.workflowStatus,
      selectedConversation.lastMessageAt
    );
  }, [
    selectedId,
    selectedConversation?.conversationId,
    selectedConversation?.workflowStatus,
    selectedConversation?.lastMessageAt,
    markConversationRead,
  ]);

  useEffect(() => {
    const phone = searchParams.get("phone");
    const botId = searchParams.get("botId");
    if (!phone || selectedId) return;
    const match = conversations.find(
      (conv) =>
        conv.phoneNumber === phone && (!botId || conv.botId === botId)
    );
    if (match) setSelectedId(match.conversationId);
  }, [conversations, searchParams, selectedId]);

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

  function categoryLabel(category?: InteractionCategory): string {
    if (!category) return t("conversations.categoryUncategorized");
    return t(interactionCategoryLabelKey(category));
  }
  const isHuman = (selectedConversation?.handoffMode ?? "bot") === "human";
  const needsClaim =
    advisorMode &&
    !!selectedConversation &&
    isHuman &&
    !selectedConversation.assignedAdvisorId;
  const canCompose = isHuman && !!selectedConversation && !needsClaim && !isImapReadOnly;
  const showBookingAction = canCompose;
  const showAttachmentAction =
    canCompose && (selectedConversation?.channel ?? "whatsapp") === "whatsapp";
  const assignedAdvisor = advisors?.find(
    (a) => a.advisorId === selectedConversation?.assignedAdvisorId
  );
  const macroPlaceholderContext = {
    contactName: selectedConversation ? contactDisplay(selectedConversation) : undefined,
    phoneNumber: selectedConversation?.phoneNumber,
    advisorName: assignedAdvisor?.name ?? (advisorMode ? currentUser?.name : undefined),
  };

  async function handleSend() {
    if (!selectedConversation || !draft.trim()) return;
    await sendMessage.mutateAsync({
      conversationId: selectedConversation.conversationId,
      botId: selectedConversation.botId,
      content: draft.trim(),
    });
    setDraft("");
  }

  async function handleAttachFile(file: File) {
    if (!selectedConversation) return;

    const validationError = validateConversationAttachmentFile(file);
    if (validationError === "empty") {
      await alert({
        title: t("conversations.attachFile"),
        message: t("conversations.attachFileEmpty"),
      });
      return;
    }
    if (validationError === "tooLarge") {
      await alert({
        title: t("conversations.attachFile"),
        message: t("conversations.attachFileTooLarge"),
      });
      return;
    }
    if (validationError === "unsupported") {
      await alert({
        title: t("conversations.attachFile"),
        message: t("conversations.attachFileUnsupported"),
      });
      return;
    }

    const isAudio = isAudioAttachmentFile(file);

    try {
      await sendAttachment.mutateAsync({
        conversationId: selectedConversation.conversationId,
        botId: selectedConversation.botId,
        file,
        ...(!isAudio && draft.trim() ? { caption: draft.trim() } : {}),
      });
      if (!isAudio) {
        setDraft("");
      }
    } catch (error) {
      const message =
        error instanceof Error && error.message === "uploadFailed"
          ? t("conversations.attachFileUploadFailed")
          : t("conversations.attachFileSendFailed");
      await alert({
        title: t("conversations.attachFile"),
        message,
      });
    }
  }

  async function handleSendVoiceNote(file: File) {
    if (!selectedConversation) return;

    try {
      await sendAttachment.mutateAsync({
        conversationId: selectedConversation.conversationId,
        botId: selectedConversation.botId,
        file,
        voiceNote: true,
      });
      setDraft("");
    } catch {
      await alert({
        title: t("conversations.voiceNoteRecord"),
        message: t("conversations.attachFileSendFailed"),
      });
    }
  }

  async function handleMicDenied() {
    await alert({
      title: t("conversations.voiceNoteRecord"),
      message: t("conversations.voiceNoteMicDenied"),
    });
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
      await alert({
        title: t("conversations.bulkReassignTitle"),
        message: t("conversations.bulkReassignSuccess", { count: result.succeeded.length }),
        tone: "success",
      });
    } else {
      await alert({
        title: t("conversations.bulkReassignTitle"),
        message: t("conversations.bulkReassignPartial", {
          succeeded: result.succeeded.length,
          failed: result.failed.length,
        }),
        tone: "warning",
      });
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

  async function handleResolve() {
    if (!selectedConversation) return;
    await resolveConv.mutateAsync({
      conversationId: selectedConversation.conversationId,
      botId: selectedConversation.botId,
      ...(csatScore !== "" ? { csatScore: Number(csatScore) } : {}),
      ...(resolveCategory ? { interactionCategory: resolveCategory } : {}),
    });
    setShowResolveModal(false);
    setCsatScore("");
    setResolveCategory("");
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

  async function handleClear() {
    if (!selectedConversation) return;
    await clearConv.mutateAsync({
      conversationId: selectedConversation.conversationId,
      botId: selectedConversation.botId,
    });
    setShowClearModal(false);
  }

  async function handleBulkDelete() {
    const items = filteredConversations
      .filter((conv) => selectedConversationIds.has(conv.conversationId))
      .map((conv) => ({ conversationId: conv.conversationId, botId: conv.botId }));
    if (items.length === 0) return;

    const result = await bulkDelete.mutateAsync({ items });

    setShowBulkDeleteModal(false);
    setSelectedConversationIds(new Set());
    if (selectedId && result.succeeded.includes(selectedId)) {
      setSelectedId(null);
    }

    if (result.failed.length === 0) {
      await alert({
        title: t("conversations.bulkDeleteTitle"),
        message: t("conversations.bulkDeleteSuccess", { count: result.succeeded.length }),
        tone: "success",
      });
    } else {
      await alert({
        title: t("conversations.bulkDeleteTitle"),
        message: t("conversations.bulkDeletePartial", {
          succeeded: result.succeeded.length,
          failed: result.failed.length,
        }),
        tone: "warning",
      });
    }
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
    <div className="conversations-workspace flex min-h-0 flex-1 overflow-hidden">
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
        onChannelFilterChange={(value) => {
          setChannelFilter(value);
          if (value !== "whatsapp") {
            setWhatsappChannelFilter("");
          }
        }}
        whatsappChannelFilter={whatsappChannelFilter}
        onWhatsappChannelFilterChange={setWhatsappChannelFilter}
        handoffFilter={handoffFilter}
        onHandoffFilterChange={setHandoffFilter}
        workflowFilter={workflowFilter}
        onWorkflowFilterChange={setWorkflowFilter}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        categoryLabel={categoryLabel}
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
        onBulkDelete={() => setShowBulkDeleteModal(true)}
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
          "relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
          showDetailOnMobile ? "flex" : "hidden lg:flex"
        )}
        data-contact-panel-collapsed={contactPanelCollapsed || undefined}
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
            <div className="conversations-chat-header relative z-30 flex min-h-[64px] flex-shrink-0 flex-col gap-3 overflow-visible px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
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
                  {(selectedConversation.channel ?? "whatsapp") === "whatsapp" &&
                  selectedConversation.whatsappDisplayNumber ? (
                    <p className="truncate text-xs text-muted">
                      {t("conversations.replyingFrom", {
                        number: selectedConversation.whatsappDisplayNumber,
                      })}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setContactPanelCollapsed((collapsed) => !collapsed)}
                  className="hidden h-9 w-9 items-center justify-center rounded-xl border border-default bg-surface-muted text-secondary transition-colors hover:bg-surface-elevated hover:text-primary xl:inline-flex"
                  aria-label={
                    contactPanelCollapsed
                      ? t("conversations.showContactPanel")
                      : t("conversations.hideContactPanel")
                  }
                  title={
                    contactPanelCollapsed
                      ? t("conversations.showContactPanel")
                      : t("conversations.hideContactPanel")
                  }
                >
                  {contactPanelCollapsed ? (
                    <PanelRightOpen className="h-4 w-4" />
                  ) : (
                    <PanelRightClose className="h-4 w-4" />
                  )}
                </button>
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
                  onClear={() => setShowClearModal(true)}
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
              <p className="border-b border-warning/30 bg-warning/10 px-4 py-2 text-xs leading-relaxed text-primary sm:px-6">
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

            {selectedConversation && !activeLead && selectedContactPhone && (
              <div className="relative z-10 mx-4 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-default bg-surface-muted p-3 text-sm text-primary shadow-sm">
                <span className="text-secondary">{t("leads.noLeadForConversation")}</span>
                <button
                  type="button"
                  onClick={() => void handleCreateLeadFromInbox()}
                  disabled={createLead.isPending}
                  className="text-xs font-medium text-accent hover:text-accent"
                >
                  {t("leads.createFromInbox")}
                </button>
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

            <div className="conversations-chat-bg relative flex min-h-0 flex-1 flex-col">
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
                  crossChannelMessages={crossChannelMessages}
                  conversation={selectedConversation}
                  loading={loadingMessages || loadingCrossChannel}
                  loadingLabel={t("common.loading")}
                  channelLabel={channelLabel}
                />
              )}

              {canCompose ? (
                <div className="conversations-chat-footer relative z-20 flex-shrink-0">
                  <div className="conversations-chat-footer-inner w-full">
                    {selectedConversation ? (
                      <AdvisorCopilotPanel
                        conversation={selectedConversation}
                        onInsertSuggestion={setDraft}
                      />
                    ) : null}
                    <ConversationComposeBar
                      draft={draft}
                      onDraftChange={setDraft}
                      onSubmit={handleSend}
                      sending={sendMessage.isPending || sendAttachment.isPending}
                      conversation={selectedConversation}
                      macroPlaceholderContext={macroPlaceholderContext}
                      onOpenQuotation={() => setShowQuotationDrawer(true)}
                      onOpenBooking={() => setShowBookingDrawer(true)}
                      showBooking={showBookingAction}
                      showAttachment={showAttachmentAction}
                      onAttachFile={handleAttachFile}
                      onSendVoiceNote={handleSendVoiceNote}
                      onMicDenied={handleMicDenied}
                      attaching={sendAttachment.isPending}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>

      {selectedConversation && !contactPanelCollapsed && (
        <ConversationContactPanel
          conversation={selectedConversation}
          activeLead={activeLead}
          onAssignAdvisor={() => setShowHandoffModal(true)}
          channelLabel={channelLabel}
          locale={locale}
          onCreateQuotation={() => setShowQuotationDrawer(true)}
          onCreateBooking={() => setShowBookingDrawer(true)}
          showBooking={showBookingAction}
          whatsappRisk={whatsappRisk}
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
            <label className="block text-sm text-secondary">{t("conversations.categoryLabel")}</label>
            <Select
              value={resolveCategory}
              onChange={(e) => setResolveCategory(e.target.value as InteractionCategory | "")}
            >
              <option value="">{t("conversations.categorySelectPlaceholder")}</option>
              {INTERACTION_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {t(interactionCategoryLabelKey(category))}
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

      {showClearModal && selectedConversation && (
        <ConfirmDialog
          open={showClearModal}
          title={t("conversations.clearTitle")}
          description={t("conversations.clearConfirm")}
          confirmLabel={t("conversations.clear")}
          tone="warning"
          loading={clearConv.isPending}
          onConfirm={handleClear}
          onCancel={() => setShowClearModal(false)}
        />
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

      {showBulkDeleteModal && (
        <ConfirmDialog
          open={showBulkDeleteModal}
          title={t("conversations.bulkDeleteTitle")}
          description={t("conversations.bulkDeleteConfirm", {
            count: selectedConversationIds.size,
          })}
          confirmLabel={t("conversations.delete")}
          tone="danger"
          loading={bulkDelete.isPending}
          onConfirm={handleBulkDelete}
          onCancel={() => setShowBulkDeleteModal(false)}
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
      {showBookingDrawer && selectedConversation ? (
        <BookingDrawer
          conversation={selectedConversation}
          open={showBookingDrawer}
          onClose={() => setShowBookingDrawer(false)}
        />
      ) : null}

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
