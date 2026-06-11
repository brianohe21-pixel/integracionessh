"use client";

import { useState } from "react";
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
} from "@/hooks/useConversations";
import { useAdvisors } from "@/hooks/useAdvisors";
import { useBots } from "@/hooks/useBots";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useFormatters } from "@/hooks/useFormatters";
import { useT } from "@/i18n/context";
import { buildWaMeLink } from "@/lib/wa-link";
import {
  MessageSquare,
  User,
  Bot,
  Phone,
  Headphones,
  Send,
  ExternalLink,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message, WorkflowStatus } from "@/types";

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
  const [workflowFilter, setWorkflowFilter] = useState<"" | WorkflowStatus>("");
  const [draft, setDraft] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [showHandoffModal, setShowHandoffModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [csatScore, setCsatScore] = useState<number | "">("");
  const [selectedAdvisorId, setSelectedAdvisorId] = useState("");

  const { data: bots } = useBots();
  const { data: advisors } = useAdvisors();
  const { data: conversations, isLoading } = useConversations({
    botId: botFilter || undefined,
    handoffMode: handoffFilter || undefined,
    workflowStatus: workflowFilter || undefined,
  });
  const { data: messages, isLoading: loadingMessages } = useConversationMessages(selectedId ?? "");

  const handoff = useHandoffConversation();
  const callPermission = useMutation({
    mutationFn: (params: { botId: string; to: string }) =>
      api.post(`/bots/${params.botId}/calling/calls/permission-request`, { to: params.to }),
  });
  const release = useReleaseConversation();
  const sendMessage = useSendConversationMessage();
  const updateNote = useUpdateConversationNote();
  const resolveConv = useResolveConversation();

  const selectedConversation = conversations?.find((c) => c.conversationId === selectedId);

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

  const showListOnMobile = !selectedId;
  const showDetailOnMobile = Boolean(selectedId);

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] lg:h-screen">
      <div
        className={cn(
          "flex w-full flex-col border-r border-gray-200 bg-white lg:w-80 lg:flex-shrink-0",
          showListOnMobile ? "flex" : "hidden lg:flex"
        )}
      >
        <div className="space-y-3 border-b border-gray-200 p-4">
          <h1 className="font-bold text-gray-900">
            {advisorMode ? t("inbox.title") : t("conversations.title")}
          </h1>
          {!advisorMode && (
            <select
              value={botFilter}
              onChange={(e) => setBotFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">{t("conversations.allBots")}</option>
              {bots?.map((bot) => (
                <option key={bot.botId} value={bot.botId}>
                  {bot.name}
                </option>
              ))}
            </select>
          )}
          <select
            value={handoffFilter}
            onChange={(e) => setHandoffFilter(e.target.value as "" | "human" | "bot")}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
          >
            <option value="">{t("conversations.filterAll")}</option>
            <option value="human">{t("conversations.filterHuman")}</option>
            <option value="bot">{t("conversations.filterBot")}</option>
          </select>
          {handoffFilter === "human" && (
            <select
              value={workflowFilter}
              onChange={(e) => setWorkflowFilter(e.target.value as "" | WorkflowStatus)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
            >
              <option value="">{t("conversations.filterWorkflowAll")}</option>
              <option value="new">{t("conversations.filterWorkflowNew")}</option>
              <option value="open">{t("conversations.filterWorkflowOpen")}</option>
              <option value="pending">{t("conversations.filterWorkflowPending")}</option>
              <option value="resolved">{t("conversations.filterWorkflowResolved")}</option>
            </select>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading && <p className="p-4 text-sm text-gray-400">{t("common.loading")}</p>}

          {!isLoading && conversations?.length === 0 && (
            <EmptyState
              icon={<MessageSquare className="w-5 h-5" />}
              title={t("conversations.emptyTitle")}
              description={t("conversations.emptyDescription")}
              className="py-12"
            />
          )}

          {conversations?.map((conv) => (
            <button
              key={conv.conversationId}
              type="button"
              onClick={() => setSelectedId(conv.conversationId)}
              className={cn(
                "w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50",
                selectedId === conv.conversationId && "bg-indigo-50 border-l-2 border-l-indigo-600"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {conv.contactName ?? conv.phoneNumber}
                    </p>
                    <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                      {formatRelativeTime(conv.lastMessageAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
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
        </div>
      </div>

      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col bg-gray-50",
          showDetailOnMobile ? "flex" : "hidden lg:flex"
        )}
      >
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
            <div className="flex flex-col gap-3 border-b border-gray-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 lg:hidden"
                  aria-label={t("conversations.backToList")}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-gray-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-gray-900 truncate">
                    {selectedConversation.contactName ?? selectedConversation.phoneNumber}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Phone className="w-3 h-3 flex-shrink-0" />
                    {selectedConversation.phoneNumber}
                  </div>
                </div>
              </div>
              <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                {!advisorMode && !isHuman && (
                  <button
                    type="button"
                    onClick={() => setShowHandoffModal(true)}
                    className="px-3 py-1.5 text-xs font-medium bg-amber-100 text-amber-800 rounded-lg"
                  >
                    {t("conversations.transfer")}
                  </button>
                )}
                {!advisorMode && selectedConversation.botId && (
                  <button
                    type="button"
                    onClick={() =>
                      callPermission.mutate({
                        botId: selectedConversation.botId,
                        to: selectedConversation.phoneNumber,
                      })
                    }
                    disabled={callPermission.isPending}
                    className="px-3 py-1.5 text-xs font-medium bg-violet-100 text-violet-800 rounded-lg"
                  >
                    {t("conversations.requestCallPermission")}
                  </button>
                )}
                {isHuman && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setInternalNote(selectedConversation.internalNote ?? "");
                        setShowResolveModal(true);
                      }}
                      className="px-3 py-1.5 text-xs font-medium bg-indigo-100 text-indigo-800 rounded-lg"
                    >
                      {t("conversations.resolve")}
                    </button>
                    <a
                      href={buildWaMeLink(selectedConversation.phoneNumber)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-green-100 text-green-800 rounded-lg"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {t("conversations.openWhatsApp")}
                    </a>
                    <button
                      type="button"
                      onClick={handleRelease}
                      disabled={release.isPending}
                      className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg"
                    >
                      {t("conversations.release")}
                    </button>
                  </>
                )}
              </div>
            </div>

            {isHuman && (
              <p className="px-6 py-2 text-xs text-amber-800 bg-amber-50 border-b border-amber-100">
                {t("conversations.personalChannelHint")}
              </p>
            )}

            {isHuman && selectedConversation.workflowStatus !== "resolved" && (
              <div className="px-6 py-3 bg-white border-b border-gray-100 space-y-2">
                <label className="text-xs font-medium text-gray-600">{t("conversations.internalNote")}</label>
                <textarea
                  value={internalNote || selectedConversation.internalNote || ""}
                  onChange={(e) => setInternalNote(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
                <button
                  type="button"
                  onClick={handleSaveNote}
                  disabled={updateNote.isPending}
                  className="text-xs text-indigo-600 font-medium"
                >
                  {t("conversations.saveNote")}
                </button>
              </div>
            )}

            <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-6">
              {loadingMessages && <p className="text-sm text-gray-400">{t("common.loading")}</p>}

              {messages?.map((msg, index) => {
                const listKey = messageListKey(msg, index);
                const isInbound = msg.role === "user";
                const isSystem = msg.role === "system";
                if (isSystem) {
                  return (
                    <p key={listKey} className="text-center text-xs text-gray-400 py-1">
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
                      <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="w-3.5 h-3.5 text-gray-500" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[85%] sm:max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
                        isInbound
                          ? "bg-white border border-gray-200 text-gray-900 rounded-bl-sm"
                          : msg.role === "advisor"
                            ? "bg-emerald-600 text-white rounded-br-sm"
                            : "bg-indigo-600 text-white rounded-br-sm"
                      )}
                    >
                      <p>{msg.content}</p>
                      <p
                        className={cn(
                          "text-[10px] mt-1",
                          isInbound ? "text-gray-400" : "text-white/70"
                        )}
                      >
                        {formatDate(msg.timestamp)}
                      </p>
                    </div>
                    {!isInbound && (
                      <div
                        className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0",
                          msg.role === "advisor" ? "bg-emerald-100" : "bg-indigo-100"
                        )}
                      >
                        {msg.role === "advisor" ? (
                          <Headphones className="w-3.5 h-3.5 text-emerald-700" />
                        ) : (
                          <Bot className="w-3.5 h-3.5 text-indigo-600" />
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
                className="bg-white border-t border-gray-200 p-4 flex gap-2"
              >
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={2}
                  placeholder={t("conversations.messagePlaceholder")}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || sendMessage.isPending}
                  className="self-end px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            )}
          </>
        )}
      </div>

      {showResolveModal && selectedConversation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold">{t("conversations.resolveTitle")}</h2>
            <label className="block text-sm text-gray-600">{t("conversations.csatLabel")}</label>
            <select
              value={csatScore}
              onChange={(e) => setCsatScore(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            >
              <option value="">—</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowResolveModal(false)}
                className="px-4 py-2 text-sm text-gray-600"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={handleResolve}
                disabled={resolveConv.isPending}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg"
              >
                {t("conversations.resolveConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showHandoffModal && selectedConversation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold">{t("conversations.transfer")}</h2>
            <select
              value={selectedAdvisorId}
              onChange={(e) => setSelectedAdvisorId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            >
              <option value="">{t("conversations.autoAssign")}</option>
              {advisors
                ?.filter((a) => a.status === "active")
                .map((a) => (
                  <option key={a.advisorId} value={a.advisorId}>
                    {a.name}
                  </option>
                ))}
            </select>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowHandoffModal(false)}
                className="px-4 py-2 text-sm text-gray-600"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={handleHandoff}
                disabled={handoff.isPending}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg"
              >
                {t("conversations.transfer")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
