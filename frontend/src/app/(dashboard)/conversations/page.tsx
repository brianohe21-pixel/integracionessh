"use client";

import { useState } from "react";
import { useConversations, useConversationMessages } from "@/hooks/useConversations";
import { useBots } from "@/hooks/useBots";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatRelativeTime, formatDate } from "@/lib/utils";
import { MessageSquare, User, Bot, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ConversationsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [botFilter, setBotFilter] = useState<string>("");

  const { data: bots } = useBots();
  const { data: conversations, isLoading } = useConversations(botFilter || undefined);
  const { data: messages, isLoading: loadingMessages } = useConversationMessages(selectedId ?? "");

  const selectedConversation = conversations?.find(
    (c) => c.conversationId === selectedId
  );

  return (
    <div className="flex h-screen">
      <div className="w-80 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="font-bold text-gray-900 mb-3">Conversaciones</h1>
          <select
            value={botFilter}
            onChange={(e) => setBotFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Todos los bots</option>
            {bots?.map((bot) => (
              <option key={bot.botId} value={bot.botId}>
                {bot.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="space-y-1 p-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="p-3 rounded-lg animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-gray-200 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 bg-gray-200 rounded w-3/4" />
                      <div className="h-3 bg-gray-200 rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && conversations?.length === 0 && (
            <EmptyState
              icon={<MessageSquare className="w-5 h-5" />}
              title="Sin conversaciones"
              description="Las conversaciones de tus bots aparecerán aquí."
              className="py-12"
            />
          )}

          {conversations?.map((conv) => (
            <button
              key={conv.conversationId}
              onClick={() => setSelectedId(conv.conversationId)}
              className={cn(
                "w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors",
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
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{conv.messageCount} mensajes</span>
                    <Badge variant={conv.status === "active" ? "success" : "default"} className="text-[10px]">
                      {conv.status === "active" ? "Activa" : "Cerrada"}
                    </Badge>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-gray-50">
        {!selectedConversation ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              icon={<MessageSquare className="w-6 h-6" />}
              title="Selecciona una conversación"
              description="Elige una conversación de la lista para ver el historial de mensajes."
            />
          </div>
        ) : (
          <>
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
              <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-gray-400" />
              </div>
              <div>
                <p className="font-semibold text-sm text-gray-900">
                  {selectedConversation.contactName ?? selectedConversation.phoneNumber}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Phone className="w-3 h-3" />
                  {selectedConversation.phoneNumber}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {loadingMessages && (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex animate-pulse",
                        i % 2 === 0 ? "justify-start" : "justify-end"
                      )}
                    >
                      <div className="h-12 w-48 bg-gray-200 rounded-2xl" />
                    </div>
                  ))}
                </div>
              )}

              {messages?.map((msg) => (
                <div
                  key={msg.messageId}
                  className={cn(
                    "flex items-end gap-2",
                    msg.role === "user" ? "justify-start" : "justify-end"
                  )}
                >
                  {msg.role === "user" && (
                    <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-3.5 h-3.5 text-gray-500" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
                      msg.role === "user"
                        ? "bg-white border border-gray-200 text-gray-900 rounded-bl-sm"
                        : "bg-indigo-600 text-white rounded-br-sm"
                    )}
                  >
                    <p>{msg.content}</p>
                    <p className={cn(
                      "text-[10px] mt-1",
                      msg.role === "user" ? "text-gray-400" : "text-indigo-200"
                    )}>
                      {formatDate(msg.timestamp)}
                    </p>
                  </div>
                  {msg.role === "assistant" && (
                    <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Bot className="w-3.5 h-3.5 text-indigo-600" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
