"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Phone, Signal } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { useT } from "@/i18n/context";
import { useWhatsAppConnect } from "@/hooks/useWhatsAppConnect";
import type { WhatsAppPhoneInfo, WhatsAppQualityRating } from "@/types";

const QUALITY_KEYS: Record<WhatsAppQualityRating, "bots.qualityHigh" | "bots.qualityMedium" | "bots.qualityLow" | "bots.qualityNa"> = {
  GREEN: "bots.qualityHigh",
  YELLOW: "bots.qualityMedium",
  RED: "bots.qualityLow",
  NA: "bots.qualityNa",
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

const STATUS_KEYS: Record<string, string> = {
  CONNECTED: "bots.statusConnected",
  RESTRICTED: "bots.statusRestricted",
  FLAGGED: "bots.statusFlagged",
  DISCONNECTED: "bots.statusDisconnected",
  PENDING: "bots.statusPending",
  DELETED: "bots.statusDeleted",
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
  botId: string;
  phoneNumberId: string;
  whatsappPhone?: WhatsAppPhoneInfo | null;
  isLoading?: boolean;
}

export function BotWhatsAppQuality({
  botId,
  phoneNumberId,
  whatsappPhone,
  isLoading,
}: BotWhatsAppQualityProps) {
  const t = useT();
  const queryClient = useQueryClient();
  const { register, status, error, reset } = useWhatsAppConnect();
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const pinValid = /^\d{6}$/.test(pin);
  const isRegistering = status === "connecting";
  const isPending = whatsappPhone?.status === "PENDING";
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
        <h2 className="text-sm font-semibold text-gray-900">{t("bots.whatsappSection")}</h2>
      </div>

      {whatsappPhone === undefined || whatsappPhone === null ? (
        <p className="text-xs text-gray-500">{t("bots.qualityLoadError")}</p>
      ) : (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-gray-500 mb-1">{t("bots.qualityTitle")}</dt>
            <dd>
              <Badge variant={QUALITY_VARIANTS[whatsappPhone.qualityRating]}>
                {t(QUALITY_KEYS[whatsappPhone.qualityRating])}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 mb-1">{t("common.status")}</dt>
            <dd className="text-gray-900 font-medium">
              {t(STATUS_KEYS[whatsappPhone.status] ?? whatsappPhone.status)}
            </dd>
          </div>
          {whatsappPhone.displayPhoneNumber && (
            <div>
              <dt className="text-xs text-gray-500 mb-1">{t("bots.displayNumber")}</dt>
              <dd className="text-gray-900">{whatsappPhone.displayPhoneNumber}</dd>
            </div>
          )}
          {whatsappPhone.verifiedName && (
            <div>
              <dt className="text-xs text-gray-500 mb-1">{t("bots.verifiedName")}</dt>
              <dd className="text-gray-900">{whatsappPhone.verifiedName}</dd>
            </div>
          )}
          {formatMessagingLimit(whatsappPhone.messagingLimit) && (
            <div>
              <dt className="text-xs text-gray-500 mb-1">{t("bots.messagingLimit")}</dt>
              <dd className="text-gray-900">
                {formatMessagingLimit(whatsappPhone.messagingLimit)}
              </dd>
            </div>
          )}
        </dl>
      )}

      {isPending && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900 mb-1">{t("whatsapp.pendingTitle")}</p>
          <p className="text-xs text-amber-800 mb-3">{t("whatsapp.pendingDescription")}</p>
          <label htmlFor={`register-pin-${botId}`} className="block text-xs font-medium text-amber-900 mb-1">
            {t("whatsapp.pinLabel")}
          </label>
          <input
            id={`register-pin-${botId}`}
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, "").slice(0, 6));
              if (pinError) setPinError("");
              if (registerSuccess) setRegisterSuccess(false);
              if (error) reset();
            }}
            placeholder={t("whatsapp.pinPlaceholder")}
            className="w-full max-w-xs rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-mono tracking-widest"
          />
          <p className="mt-1 text-xs text-amber-800">{t("whatsapp.pinHint")}</p>
          {pinError && <p className="mt-1 text-xs text-red-600">{pinError}</p>}
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
          {registerSuccess && (
            <p className="mt-2 text-xs text-green-700">{t("whatsapp.registerSuccess")}</p>
          )}
          <button
            type="button"
            disabled={isRegistering}
            onClick={async () => {
              if (!pinValid) {
                setPinError(t("whatsapp.pinInvalid"));
                return;
              }
              setPinError("");
              try {
                await register({ phoneNumberId, pin });
                setRegisterSuccess(true);
                await queryClient.invalidateQueries({ queryKey: ["bots", "detail", botId] });
              } catch {
                setRegisterSuccess(false);
              }
            }}
            className="mt-3 inline-flex items-center rounded-lg bg-amber-700 px-3 py-2 text-xs font-medium text-white hover:bg-amber-800 disabled:opacity-60"
          >
            {isRegistering ? t("whatsapp.registering") : t("whatsapp.registerButton")}
          </button>
        </div>
      )}

      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-200 text-xs text-gray-400">
        <Phone className="w-3.5 h-3.5" />
        <span className="font-mono">{phoneNumberId}</span>
      </div>
    </div>
  );
}
