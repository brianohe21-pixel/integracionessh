"use client";

import { Phone, Signal } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { WhatsAppPhoneInfo, WhatsAppQualityRating } from "@/types";

const QUALITY_LABELS: Record<WhatsAppQualityRating, string> = {
  GREEN: "Alta",
  YELLOW: "Media",
  RED: "Baja",
  NA: "Sin datos",
};

const QUALITY_VARIANTS: Record<
  WhatsAppQualityRating,
  "success" | "warning" | "danger" | "default"
> = {
  GREEN: "success",
  YELLOW: "warning",
  RED: "danger",
  NA: "default",
};

const STATUS_LABELS: Record<string, string> = {
  CONNECTED: "Conectado",
  RESTRICTED: "Restringido",
  FLAGGED: "Marcado",
  DISCONNECTED: "Desconectado",
  PENDING: "Pendiente",
  DELETED: "Eliminado",
};

function formatMessagingLimit(limit?: string): string | null {
  if (!limit) return null;
  const match = limit.match(/^TIER_(\d+)$/);
  if (match) {
    const n = Number(match[1]);
    if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K / 24h`;
    return `${n} / 24h`;
  }
  return limit.replace(/_/g, " ");
}

interface BotWhatsAppQualityProps {
  phoneNumberId: string;
  whatsappPhone?: WhatsAppPhoneInfo | null;
  isLoading?: boolean;
}

export function BotWhatsAppQuality({
  phoneNumberId,
  whatsappPhone,
  isLoading,
}: BotWhatsAppQualityProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 animate-pulse">
        <div className="h-4 w-40 bg-gray-200 rounded mb-3" />
        <div className="h-6 w-24 bg-gray-200 rounded" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Signal className="w-4 h-4 text-indigo-600" />
        <h2 className="text-sm font-semibold text-gray-900">WhatsApp</h2>
      </div>

      {whatsappPhone === undefined || whatsappPhone === null ? (
        <p className="text-xs text-gray-500">
          No se pudo obtener la calidad del número. Verifica el token de WhatsApp y el Phone
          Number ID.
        </p>
      ) : (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-gray-500 mb-1">Calidad del número</dt>
            <dd>
              <Badge variant={QUALITY_VARIANTS[whatsappPhone.qualityRating]}>
                {QUALITY_LABELS[whatsappPhone.qualityRating]}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 mb-1">Estado</dt>
            <dd className="text-gray-900 font-medium">
              {STATUS_LABELS[whatsappPhone.status] ?? whatsappPhone.status}
            </dd>
          </div>
          {whatsappPhone.displayPhoneNumber && (
            <div>
              <dt className="text-xs text-gray-500 mb-1">Número</dt>
              <dd className="text-gray-900">{whatsappPhone.displayPhoneNumber}</dd>
            </div>
          )}
          {whatsappPhone.verifiedName && (
            <div>
              <dt className="text-xs text-gray-500 mb-1">Nombre verificado</dt>
              <dd className="text-gray-900">{whatsappPhone.verifiedName}</dd>
            </div>
          )}
          {formatMessagingLimit(whatsappPhone.messagingLimit) && (
            <div>
              <dt className="text-xs text-gray-500 mb-1">Límite de mensajería</dt>
              <dd className="text-gray-900">
                {formatMessagingLimit(whatsappPhone.messagingLimit)}
              </dd>
            </div>
          )}
        </dl>
      )}

      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-200 text-xs text-gray-400">
        <Phone className="w-3.5 h-3.5" />
        <span className="font-mono">{phoneNumberId}</span>
      </div>
    </div>
  );
}
