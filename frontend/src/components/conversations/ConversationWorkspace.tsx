"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  useConversations,
  useConversationMessages,
  useHandoffConversation,
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message, WorkflowStatus, Channel } from "@/types";
import { useActiveLeadByPhone, useConvertLead } from "@/hooks/useLeads";
import Link from "next/link";
import { AdvisorCallPanel } from "@/components/conversations/AdvisorCallPanel";
import { WhatsAppSoftphone } from "@/components/conversations/WhatsAppSoftphone";
import { ConversationContactPanel } from "@/components/conversations/ConversationContactPanel";
import { MacroPicker } from "@/components/conversations/MacroPicker";
import { useCurrentUser } from "@/hooks/useCurrentUser";

function messageListKey(msg: Message, index: number): string {
  return `${msg.messageId}::${msg.timestamp}::${index}`;
}

type Props = {
  advisorMode?: boolean;
};

export function ConversationWorkspace({ advisorMode = false }: Props) {
  const t = useT();
  const { formatRelativeTime, formatDate } = useFormatters();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [botFilter, setBotFilter] = useState<string>("");
  const [handoffFilter, setHandoffFilter] = useState<"" | "human" | "bot">("");
  const [channelFilter, setChannelFilter] = useState<"" | Channel>("");
  const [workflowFilter, setWorkflowFilter] = useState<"" | WorkflowStatus>("");
  const [draft, setDraft] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [showHandoffModal, setShowHandoffModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [csatScore, setCsatScore] = useState<number | "">("");
  const [callPermissionFeedback, setCallPermissionFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [selectedAdvisorId, setSelectedAdvisorId] = useState("");
  const [listTab, setListTab] = useState<"all" | "unread" | "mine">("all");

  const { data: bots } = useBots();
  const { data: advisors } = useAdvisors();
  const { user: currentUser } = useCurrentUser();
  const {
    data: conversationsData,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useConversations({
    botId: botFilter || undefined,
    channel: channelFilter || undefined,
    handoffMode: handoffFilter || undefined,
    workflowStatus: workflowFilter || undefined,
  });
  const conversations =
    conversationsData?.pages.flatMap((page) => page.items).filter((c) => c != null) ?? [];

  const filteredConversations = conversations.filter((conv) => {
    if (listTab === "unread") return conv.workflowStatus === "new";
    if (listTab === "mine") return (conv.handoffMode ?? "bot") === "human";
    return true;
  });

  const unreadCount = conversations.filter((c) => c.workflowStatus === "new").length;
  const listScrollRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const { data: messages, isLoading: loadingMessages } = useConversationMessages(selectedId ?? "");

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
    return t("conversations.channelWhatsapp");
  }

  function contactDisplay(conv: { contactName?: string; phoneNumber: string; participantId?: string; channel?: Channel }) {
    if (conv.contactName) return conv.contactName;
    if ((conv.channel ?? "whatsapp") === "whatsapp") return conv.phoneNumber;
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
  const canCompose = isHuman && !!selectedConversation;
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
          <Tabs
            items={[
              { id: "all", label: t("conversations.filterTabAll") },
              { id: "unread", label: t("conversations.filterTabUnread"), count: unreadCount },
              { id: "mine", label: t("conversations.filterTabMine") },
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
        </div>

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

          {filteredConversations.map((conv) => (
            <button
              key={conv.conversationId}
              type="button"
              onClick={() => setSelectedId(conv.conversationId)}
              className={cn(
                "w-full border-b border-subtle px-4 py-3 text-left transition-colors hover:bg-surface-muted",
                selectedId === conv.conversationId &&
                  "border-l-2 border-l-accent bg-accent-muted"
              )}
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
                  </div>
                </div>
              </div>
            </button>
          ))}

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
    </div>
  );
}
