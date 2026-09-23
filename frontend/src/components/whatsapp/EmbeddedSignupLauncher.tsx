"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/context";
import { useWhatsAppConnect } from "@/hooks/useWhatsAppConnect";
import { useMetaAppConfig } from "@/hooks/useMetaAppConfig";
import { IntegrationErrorSupport } from "@/components/support/IntegrationErrorSupport";
import { MessageCircle, Loader2, CheckCircle } from "lucide-react";

const FALLBACK_META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID ?? "";
const FALLBACK_CONFIG_ID = process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID ?? "";
const FB_SDK_VERSION = "v25.0";
const PIN_LENGTH = 6;
const SESSION_INFO_GRACE_MS = 5000;
const SESSION_INFO_RETRY_MS = 400;

const ALLOWED_ORIGINS = new Set(["https://www.facebook.com", "https://web.facebook.com"]);

const FINISH_EVENTS = new Set([
  "FINISH",
  "FINISH_ONLY_WABA",
  "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING",
]);

export type WhatsAppOnboardingMode = "cloud_api" | "coexistence";

interface EmbeddedSignupLauncherProps {
  onConnected: (data: {
    phoneNumberId?: string;
    whatsappBusinessAccountId: string;
    onboardingMode?: WhatsAppOnboardingMode;
    isOnBizApp?: boolean;
    platformType?: string;
    channelId?: string;
    pendingRegistration?: boolean;
  }) => void;
  alreadyConnected?: boolean;
  className?: string;
  onboardingMode?: WhatsAppOnboardingMode;
  botId?: string;
}

interface FBLoginResponse {
  authResponse?: { code?: string };
  status?: string;
}

interface EmbeddedSignupMessage {
  type?: string;
  event?: string;
  data?: {
    phone_number_id?: string;
    waba_id?: string;
    error_message?: string;
    error_code?: string | null;
    session_id?: string;
    timestamp?: string;
    current_step?: string;
  };
}

function formatMetaSignupError(
  data: EmbeddedSignupMessage["data"],
  ownerPortfolioMessage: string
): string {
  const errorCode = String(data?.error_code ?? "").trim();
  if (errorCode === "3441038") {
    const sessionRef = data?.session_id ? ` (#3441038:${data.session_id})` : " (#3441038)";
    return `${ownerPortfolioMessage}${sessionRef}`;
  }

  const message = data?.error_message?.trim();
  if (!message) return "";

  const reference = errorCode
    ? `#${errorCode}`
    : data?.session_id
      ? `#N/A:${data.session_id}`
      : "";

  return reference ? `${message} (${reference})` : message;
}

declare global {
  interface Window {
    FB?: {
      init: (params: Record<string, unknown>) => void;
      login: (callback: (response: FBLoginResponse) => void, options: Record<string, unknown>) => void;
    };
    fbAsyncInit?: () => void;
  }
}

function initFacebookSdk(appId: string) {
  window.FB?.init({
    appId,
    cookie: true,
    xfbml: true,
    version: FB_SDK_VERSION,
    fedCM: false,
  });
}

export function EmbeddedSignupLauncher({
  onConnected,
  alreadyConnected = false,
  className,
  onboardingMode = "cloud_api",
  botId,
}: EmbeddedSignupLauncherProps) {
  const t = useT();
  const { data: metaAppConfig, isLoading: metaAppLoading } = useMetaAppConfig();
  const { status, error, connect, connectCoexistence, reset, setStatus } = useWhatsAppConnect(botId);
  const [sdkReady, setSdkReady] = useState(false);
  const [localConnected, setLocalConnected] = useState(alreadyConnected);
  const [pendingRegistration, setPendingRegistration] = useState(false);
  const [pin, setPin] = useState("");
  const [signupError, setSignupError] = useState("");
  const pendingRef = useRef<{
    code?: string;
    wabaId?: string;
    phoneNumberId?: string;
    coexistence?: boolean;
    sessionFinished?: boolean;
  }>({});
  const messageHandlerRef = useRef<((event: MessageEvent) => void) | null>(null);
  const graceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completingRef = useRef(false);

  const metaAppId = metaAppConfig?.appId?.trim() || FALLBACK_META_APP_ID;
  const configId = metaAppConfig?.embeddedSignupConfigId?.trim() || FALLBACK_CONFIG_ID;
  const isConfigured = Boolean(metaAppId && configId);
  const isCoexistence = onboardingMode === "coexistence";
  const pinValid = /^\d{6}$/.test(pin);

  useEffect(() => {
    if (!metaAppId || !window.FB) return;
    initFacebookSdk(metaAppId);
    setSdkReady(true);
  }, [metaAppId]);

  const clearGraceTimer = useCallback(() => {
    if (graceTimerRef.current) {
      clearInterval(graceTimerRef.current);
      graceTimerRef.current = null;
    }
  }, []);

  const tryComplete = useCallback(async () => {
    const { code, wabaId, phoneNumberId, coexistence } = pendingRef.current;
    if (!code || !wabaId || completingRef.current) return;
    if (!coexistence && pin && !pinValid) return;

    completingRef.current = true;
    clearGraceTimer();

    try {
      if (coexistence) {
        const result = await connectCoexistence({
          code,
          wabaId,
          phoneNumberId,
        });
        pendingRef.current = {};
        setLocalConnected(true);
        setPendingRegistration(false);
        onConnected({
          phoneNumberId: result.phoneNumberId,
          whatsappBusinessAccountId: result.whatsappBusinessAccountId,
          onboardingMode: "coexistence",
          ...(result.isOnBizApp !== undefined ? { isOnBizApp: result.isOnBizApp } : {}),
          ...(result.platformType ? { platformType: result.platformType } : {}),
          ...("channel" in result && result.channel
            ? { channelId: result.channel.channelId }
            : {}),
        });
        return;
      }

      const result = await connect({
        code,
        whatsappBusinessAccountId: wabaId,
        ...(phoneNumberId ? { phoneNumberId } : {}),
        ...(pinValid ? { pin } : {}),
      });
      pendingRef.current = {};
      setLocalConnected(true);
      setPendingRegistration(result.pendingRegistration ?? false);
      onConnected({
        phoneNumberId: result.phoneNumberId,
        whatsappBusinessAccountId: result.whatsappBusinessAccountId,
        onboardingMode: "cloud_api",
        pendingRegistration: result.pendingRegistration,
        ...("channel" in result && result.channel
          ? { channelId: result.channel.channelId }
          : {}),
      });
    } catch {
      pendingRef.current = {};
      setStatus("error");
    } finally {
      completingRef.current = false;
    }
  }, [clearGraceTimer, connect, connectCoexistence, onConnected, pin, pinValid, setStatus]);

  const scheduleGraceRetries = useCallback(() => {
    if (graceTimerRef.current) return;
    const startedAt = Date.now();
    graceTimerRef.current = setInterval(() => {
      if (Date.now() - startedAt > SESSION_INFO_GRACE_MS) {
        clearGraceTimer();
        return;
      }
      void tryComplete();
    }, SESSION_INFO_RETRY_MS);
  }, [clearGraceTimer, tryComplete]);

  useEffect(() => {
    setLocalConnected(alreadyConnected);
  }, [alreadyConnected]);

  useEffect(() => {
    return () => {
      clearGraceTimer();
      if (messageHandlerRef.current) {
        window.removeEventListener("message", messageHandlerRef.current);
      }
    };
  }, [clearGraceTimer]);

  const handleLaunch = useCallback(() => {
    if (!sdkReady || !window.FB) {
      return;
    }

    setSignupError("");
    reset();
    completingRef.current = false;
    pendingRef.current = { coexistence: isCoexistence };
    clearGraceTimer();

    if (messageHandlerRef.current) {
      window.removeEventListener("message", messageHandlerRef.current);
    }

    const handler = (event: MessageEvent) => {
      if (!ALLOWED_ORIGINS.has(event.origin)) return;

      let payload: EmbeddedSignupMessage;
      try {
        payload =
          typeof event.data === "string" ? (JSON.parse(event.data) as EmbeddedSignupMessage) : event.data;
      } catch {
        return;
      }

      if (payload.type !== "WA_EMBEDDED_SIGNUP") return;

      const eventName = String(payload.event ?? "").toUpperCase();

      const metaSignupError = formatMetaSignupError(
        payload.data,
        t("whatsapp.signupErrorOwnerPortfolio")
      );

      if (eventName === "CANCEL") {
        pendingRef.current = {};
        clearGraceTimer();
        if (metaSignupError) {
          setSignupError(metaSignupError);
        } else {
          reset();
        }
        return;
      }

      if (eventName === "ERROR") {
        pendingRef.current = {};
        clearGraceTimer();
        setSignupError(metaSignupError || t("whatsapp.signupError"));
        reset();
        return;
      }

      if (payload.data?.waba_id) {
        pendingRef.current.wabaId = payload.data.waba_id;
      }
      if (payload.data?.phone_number_id) {
        pendingRef.current.phoneNumberId = payload.data.phone_number_id;
      }

      if (FINISH_EVENTS.has(eventName)) {
        pendingRef.current.sessionFinished = true;
        void tryComplete();
        scheduleGraceRetries();
      }
    };

    messageHandlerRef.current = handler;
    window.addEventListener("message", handler);

    const loginOptions: Record<string, unknown> = {
      config_id: configId,
      response_type: "code",
      override_default_response_type: true,
      extras: {
        setup: {},
        ...(isCoexistence
          ? {
              featureType: "whatsapp_business_app_onboarding",
              sessionInfoVersion: "3",
            }
          : {}),
      },
    };

    window.FB.login(
      (response) => {
        if (response.status === "connected" && response.authResponse?.code) {
          pendingRef.current.code = response.authResponse.code;
          void tryComplete();
          scheduleGraceRetries();
          return;
        }
        if (!pendingRef.current.code && response.status !== "connected") {
          clearGraceTimer();
          reset();
        }
      },
      loginOptions
    );
  }, [clearGraceTimer, configId, isCoexistence, reset, scheduleGraceRetries, sdkReady, t, tryComplete]);

  const isConnecting = status === "connecting";
  const showConnected = localConnected || status === "connected";
  const integrationError = signupError || error;

  if (metaAppLoading) {
    return (
      <div className={cn("rounded-lg border border-default bg-surface p-4 animate-pulse", className)}>
        <div className="h-4 w-40 rounded bg-gray-200" />
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <div className={cn("rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800", className)}>
        {t("whatsapp.notConfigured")}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <Script
        src="https://connect.facebook.net/en_US/sdk.js"
        strategy="lazyOnload"
        onLoad={() => {
          const initSdk = () => {
            if (!metaAppId) return;
            initFacebookSdk(metaAppId);
            setSdkReady(true);
          };
          if (window.FB) {
            initSdk();
          } else {
            window.fbAsyncInit = initSdk;
          }
        }}
      />

      <div className="rounded-lg border border-default bg-surface p-4">
        <p className="text-sm font-medium text-primary mb-1">{t("whatsapp.sectionTitle")}</p>
        <p className="text-xs text-secondary mb-4">
          {isCoexistence ? t("whatsapp.coexistenceDescription") : t("whatsapp.sectionDescription")}
        </p>

        {isCoexistence && (
          <p className="mb-4 text-xs text-secondary">{t("whatsapp.coexistenceSyncHint")}</p>
        )}

        {!isCoexistence && (
          <div className="mb-4">
            <label htmlFor="whatsapp-pin" className="block text-xs font-medium text-secondary mb-1">
              {t("whatsapp.pinLabelOptional")}
            </label>
            <input
              id="whatsapp-pin"
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={PIN_LENGTH}
              value={pin}
              onChange={(e) => {
                const next = e.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH);
                setPin(next);
              }}
              placeholder={t("whatsapp.pinPlaceholder")}
              className="w-full max-w-xs rounded-lg border border-default px-3 py-2 text-sm font-mono tracking-widest"
            />
            <p className="mt-1 text-xs text-secondary">{t("whatsapp.pinHintOptional")}</p>
          </div>
        )}

        {showConnected ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>{t("whatsapp.connected")}</span>
            </div>
            {pendingRegistration && (
              <p className="text-xs text-secondary">{t("whatsapp.pendingDescription")}</p>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={handleLaunch}
            disabled={!sdkReady || isConnecting}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-colors",
              !sdkReady || isConnecting
                ? "bg-[#25D366]/60 cursor-not-allowed"
                : "bg-[#25D366] hover:bg-[#1da851]"
            )}
          >
            {isConnecting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <MessageCircle className="w-4 h-4" />
            )}
            {isConnecting
              ? t("whatsapp.connecting")
              : isCoexistence
                ? t("whatsapp.coexistenceConnectButton")
                : showConnected
                  ? t("whatsapp.reconnect")
                  : t("whatsapp.connectButton")}
          </button>
        )}

        {showConnected && (
          <button
            type="button"
            onClick={() => {
              setLocalConnected(false);
              setPendingRegistration(false);
              reset();
              handleLaunch();
            }}
            disabled={isConnecting || !sdkReady}
            className="mt-3 text-xs font-medium text-accent hover:text-accent"
          >
            {t("whatsapp.reconnect")}
          </button>
        )}

        {!sdkReady && (
          <p className="mt-2 text-xs text-muted">{t("whatsapp.sdkLoading")}</p>
        )}
      </div>

      {integrationError ? (
        <IntegrationErrorSupport
          integration="whatsapp"
          error={integrationError}
          context={{
            flow: "embedded_signup",
            onboardingMode,
            ...(botId ? { botId } : {}),
          }}
        />
      ) : null}
    </div>
  );
}
