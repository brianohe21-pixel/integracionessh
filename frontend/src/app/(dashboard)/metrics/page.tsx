"use client";

import {
  BarChart3,
  BotMessageSquare,
  MessageSquare,
  SendHorizonal,
  LayoutTemplate,
  Activity,
} from "lucide-react";
import { useMetrics } from "@/hooks/useMetrics";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate, formatNumber, formatRelativeTime } from "@/lib/utils";
import type { BulkSendJobStatus } from "@/types";

function KpiCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className="flex items-center justify-center w-10 h-10 bg-indigo-50 rounded-xl text-indigo-600">
          {icon}
        </div>
      </div>
    </div>
  );
}

function bulkStatusVariant(status: BulkSendJobStatus): "success" | "warning" | "danger" | "default" | "info" {
  switch (status) {
    case "completed":
      return "success";
    case "processing":
    case "queued":
      return "info";
    case "failed":
      return "danger";
    default:
      return "default";
  }
}

function bulkStatusLabel(status: BulkSendJobStatus): string {
  const labels: Record<BulkSendJobStatus, string> = {
    queued: "En cola",
    processing: "Procesando",
    completed: "Completado",
    failed: "Fallido",
  };
  return labels[status] ?? status;
}

export default function MetricsPage() {
  const { data: metrics, isLoading, error } = useMetrics();

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Métricas de uso</h1>
        <p className="text-sm text-gray-500 mt-1">
          Resumen de actividad de tus chatbots, conversaciones y envíos masivos
        </p>
      </div>

      {isLoading && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse h-24" />
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse h-48" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-600 font-medium">Error al cargar las métricas</p>
          <p className="text-xs text-red-500 mt-1 break-words">{error.message}</p>
        </div>
      )}

      {!isLoading && !error && metrics && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Chatbots activos"
              value={`${formatNumber(metrics.summary.activeBots)} / ${formatNumber(metrics.summary.totalBots)}`}
              icon={<BotMessageSquare className="w-5 h-5" />}
            />
            <KpiCard
              label="Conversaciones"
              value={formatNumber(metrics.summary.totalConversations)}
              sub={`${formatNumber(metrics.summary.activeConversations)} activas`}
              icon={<MessageSquare className="w-5 h-5" />}
            />
            <KpiCard
              label="Mensajes"
              value={formatNumber(metrics.summary.totalMessages)}
              sub="Total acumulado por conversación"
              icon={<BarChart3 className="w-5 h-5" />}
            />
            <KpiCard
              label="Envíos masivos"
              value={formatNumber(metrics.summary.bulkMessagesSent)}
              sub={
                metrics.summary.bulkMessagesFailed > 0
                  ? `${formatNumber(metrics.summary.bulkMessagesFailed)} fallidos`
                  : `${formatNumber(metrics.summary.bulkJobsCount)} campañas`
              }
              icon={<SendHorizonal className="w-5 h-5" />}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard
              label="Templates"
              value={formatNumber(metrics.summary.totalTemplates)}
              icon={<LayoutTemplate className="w-5 h-5" />}
            />
            <KpiCard
              label="Campañas bulk"
              value={formatNumber(metrics.summary.bulkJobsCount)}
              icon={<SendHorizonal className="w-5 h-5" />}
            />
            <KpiCard
              label="Última actividad"
              value={
                metrics.summary.lastActivityAt
                  ? formatRelativeTime(metrics.summary.lastActivityAt)
                  : "Sin actividad"
              }
              sub={
                metrics.summary.lastActivityAt
                  ? formatDate(metrics.summary.lastActivityAt)
                  : undefined
              }
              icon={<Activity className="w-5 h-5" />}
            />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 text-sm">Uso por chatbot</h2>
            </div>

            {metrics.byBot.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<BotMessageSquare className="w-6 h-6" />}
                  title="Sin datos"
                  description="Crea un chatbot para empezar a ver métricas de uso."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                      <th className="px-6 py-3 font-medium">Bot</th>
                      <th className="px-6 py-3 font-medium">Estado</th>
                      <th className="px-6 py-3 font-medium text-right">Conversaciones</th>
                      <th className="px-6 py-3 font-medium text-right">Mensajes</th>
                      <th className="px-6 py-3 font-medium text-right">Templates</th>
                      <th className="px-6 py-3 font-medium text-right">Última actividad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {metrics.byBot.map((bot) => (
                      <tr key={bot.botId} className="hover:bg-gray-50/50">
                        <td className="px-6 py-3.5 font-medium text-gray-900">{bot.botName}</td>
                        <td className="px-6 py-3.5">
                          <Badge variant={bot.status === "active" ? "success" : "default"}>
                            {bot.status === "active" ? "Activo" : "Inactivo"}
                          </Badge>
                        </td>
                        <td className="px-6 py-3.5 text-right text-gray-700">
                          {formatNumber(bot.conversations)}
                          {bot.activeConversations > 0 && (
                            <span className="text-gray-400 ml-1">
                              ({formatNumber(bot.activeConversations)} activas)
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-right text-gray-700 font-medium">
                          {formatNumber(bot.messages)}
                        </td>
                        <td className="px-6 py-3.5 text-right text-gray-700">
                          {formatNumber(bot.templates)}
                        </td>
                        <td className="px-6 py-3.5 text-right text-gray-500">
                          {bot.lastActivityAt ? formatRelativeTime(bot.lastActivityAt) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {metrics.recentBulkJobs.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900 text-sm">Campañas de envío masivo recientes</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                      <th className="px-6 py-3 font-medium">Template</th>
                      <th className="px-6 py-3 font-medium">Estado</th>
                      <th className="px-6 py-3 font-medium text-right">Enviados</th>
                      <th className="px-6 py-3 font-medium text-right">Fallidos</th>
                      <th className="px-6 py-3 font-medium text-right">Total</th>
                      <th className="px-6 py-3 font-medium text-right">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {metrics.recentBulkJobs.map((job) => (
                      <tr key={job.jobId} className="hover:bg-gray-50/50">
                        <td className="px-6 py-3.5 font-medium text-gray-900">{job.templateName}</td>
                        <td className="px-6 py-3.5">
                          <Badge variant={bulkStatusVariant(job.status)}>
                            {bulkStatusLabel(job.status)}
                          </Badge>
                        </td>
                        <td className="px-6 py-3.5 text-right text-green-700 font-medium">
                          {formatNumber(job.sent)}
                        </td>
                        <td className="px-6 py-3.5 text-right text-red-600">
                          {formatNumber(job.failed)}
                        </td>
                        <td className="px-6 py-3.5 text-right text-gray-700">
                          {formatNumber(job.total)}
                        </td>
                        <td className="px-6 py-3.5 text-right text-gray-500">
                          {formatDate(job.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
