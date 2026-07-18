"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/context";
import { useWhatsAppConnect } from "@/hooks/useWhatsAppConnect";
import { MessageCircle, Loader2, CheckCircle } from "lucide-react";

const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID ?? "";
const CONFIG_ID = process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID ?? "";
const FB_SDK_VERSION = "v22.0";
const PIN_LENGTH = 6;

interface EmbeddedSignupLauncherProps {
  onConnected: (data: {
    phoneNumberId: string;
    whatsappBusinessAccountId: string;
  }) => void;
  alreadyConnected?: boolean;
  className?: string;
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
  };
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

export function EmbeddedSignupLauncher({
  onConnected,
  alreadyConnected = false,
  className,
}: EmbeddedSignupLauncherProps) {
  const t = useT();
  const { status, error, connect, reset } = useWhatsAppConnect();
  const [sdkReady, setSdkReady] = useState(false);
  const [localConnected, setLocalConnected] = useState(alreadyConnected);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const pendingRef = useRef<{
    code?: string;
    wabaId?: string;
    phoneNumberId?: string;
  }>({});
  const messageHandlerRef = useRef<((event: MessageEvent) => void) | null>(null);

  const isConfigured = Boolean(META_APP_ID && CONFIG_ID);
  const pinValid = /^\d{6}$/.test(pin);

  const tryComplete = useCallback(async () => {
    const { code, wabaId, phoneNumberId } = pendingRef.current;
    if (!code || !wabaId || !phoneNumberId || !pinValid) return;

    try {
      const result = await connect({
        code,
        phoneNumberId,
        whatsappBusinessAccountId: wabaId,
        pin,
      });
      pendingRef.current = {};
      setLocalConnected(true);
      onConnected({
        phoneNumberId: result.phoneNumberId,
        whatsappBusinessAccountId: result.whatsappBusinessAccountId,
      });
    } catch {
      pendingRef.current = {};
    }
  }, [connect, onConnected, pin, pinValid]);

  useEffect(() => {
    setLocalConnected(alreadyConnected);
  }, [alreadyConnected]);

  useEffect(() => {
    return () => {
      if (messageHandlerRef.current) {
        window.removeEventListener("message", messageHandlerRef.current);
      }
    };
  }, []);

  const handleLaunch = useCallback(() => {
    if (!sdkReady || !window.FB) {
      return;
    }

    if (!pinValid) {
      setPinError(t("whatsapp.pinInvalid"));
      return;
    }

    setPinError("");
    reset();
    pendingRef.current = {};

    if (messageHandlerRef.current) {
      window.removeEventListener("message", messageHandlerRef.current);
    }

    const handler = (event: MessageEvent) => {
      if (event.origin !== "https://www.facebook.com") return;

      let payload: EmbeddedSignupMessage;
      try {
        payload =
          typeof event.data === "string" ? (JSON.parse(event.data) as EmbeddedSignupMessage) : event.data;
      } catch {
        return;
      }

      if (payload.type !== "WA_EMBEDDED_SIGNUP") return;

      if (payload.event === "CANCEL") {
        pendingRef.current = {};
        reset();
        return;
      }

      if (payload.event === "FINISH" && payload.data) {
        pendingRef.current.wabaId = payload.data.waba_id;
        pendingRef.current.phoneNumberId = payload.data.phone_number_id;
        void tryComplete();
      }
    };

    messageHandlerRef.current = handler;
    window.addEventListener("message", handler);

    window.FB.login(
      (response) => {
        if (response.status === "connected" && response.authResponse?.code) {
          pendingRef.current.code = response.authResponse.code;
          void tryComplete();
          return;
        }
        if (!pendingRef.current.code && response.status !== "connected") {
          reset();
        }
      },
      {
        config_id: CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
      }
    );
  }, [pinValid, reset, sdkReady, t, tryComplete]);

  const isConnecting = status === "connecting";
  const showConnected = localConnected || status === "connected";

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
            window.FB?.init({
              appId: META_APP_ID,
              cookie: true,
              xfbml: true,
              version: FB_SDK_VERSION,
            });
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
        <p className="text-xs text-secondary mb-4">{t("whatsapp.sectionDescription")}</p>

        <div className="mb-4">
          <label htmlFor="whatsapp-pin" className="block text-xs font-medium text-secondary mb-1">
            {t("whatsapp.pinLabel")}
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
              if (pinError) setPinError("");
            }}
            placeholder={t("whatsapp.pinPlaceholder")}
            className="w-full max-w-xs rounded-lg border border-default px-3 py-2 text-sm font-mono tracking-widest"
          />
          <p className="mt-1 text-xs text-secondary">{t("whatsapp.pinHint")}</p>
          {pinError && <p className="mt-1 text-xs text-red-600">{pinError}</p>}
        </div>

        {showConnected ? (
          <div className="flex items-center gap-2 text-sm text-green-700">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <span>{t("whatsapp.connected")}</span>
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

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
}
