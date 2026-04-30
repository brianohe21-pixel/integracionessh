"use client";

import Link from "next/link";
import { BotMessageSquare, Phone, Trash2, Edit, Power, PowerOff } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import type { Bot } from "@/types";
import { useDeleteBot, useUpdateBot } from "@/hooks/useBots";

interface BotCardProps {
  bot: Bot;
}

export function BotCard({ bot }: BotCardProps) {
  const deleteBot = useDeleteBot();
  const updateBot = useUpdateBot(bot.botId);

  function handleDelete() {
    if (confirm(`¿Eliminar el bot "${bot.name}"?`)) {
      deleteBot.mutate(bot.botId);
    }
  }

  function handleToggleStatus() {
    updateBot.mutate({ status: bot.status === "active" ? "inactive" : "active" });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
            <BotMessageSquare className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">{bot.name}</h3>
            <p className="text-xs text-gray-400">{bot.model}</p>
          </div>
        </div>
        <Badge variant={bot.status === "active" ? "success" : "default"}>
          {bot.status === "active" ? "Activo" : "Inactivo"}
        </Badge>
      </div>

      <p className="text-xs text-gray-500 line-clamp-2 mb-4 leading-relaxed">
        {bot.systemPrompt}
      </p>

      <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-4">
        <Phone className="w-3.5 h-3.5" />
        <span className="font-mono">{bot.phoneNumberId}</span>
      </div>

      <div className="text-xs text-gray-400 mb-4">
        Creado {formatDate(bot.createdAt)}
      </div>

      <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
        <Link
          href={`/bots/${bot.botId}/edit`}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <Edit className="w-3.5 h-3.5" />
          Editar
        </Link>

        <button
          onClick={handleToggleStatus}
          disabled={updateBot.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
        >
          {bot.status === "active" ? (
            <PowerOff className="w-3.5 h-3.5" />
          ) : (
            <Power className="w-3.5 h-3.5" />
          )}
          {bot.status === "active" ? "Desactivar" : "Activar"}
        </button>

        <button
          onClick={handleDelete}
          disabled={deleteBot.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors ml-auto"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Eliminar
        </button>
      </div>
    </div>
  );
}
