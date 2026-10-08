"use client";

import { useCallback, useEffect, useState } from "react";
import Script from "next/script";
import { Camera, CheckCircle, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/context";
import { useMetaAppConfig } from "@/hooks/useMetaAppConfig";
import { IntegrationErrorSupport } from "@/components/support/IntegrationErrorSupport";

const FALLBACK_META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID ?? "";
const FALLBACK_CONFIG_ID = process.env.NEXT_PUBLIC_META_INSTAGRAM_LOGIN_CONFIG_ID ?? "";
const FB_SDK_VERSION = "v25.0";

const INSTAGRAM_LOGIN_SCOPES = [
  "pages_show_list",
  "pages_messaging",
  "pages_manage_metadata",
  "instagram_basic",
  "instagram_manage_messages",
  "business_management",
].join(",");

type ConnectResponse = {
  connected?: boolean;
  needsSelection?: boolean;
  instagramPageId?: string;
  instagramAccountId?: string;
  pageName?: string;
  instagramUsername?: string;
  pages?: Array<{
    pageId: string;
    pageName: string;
    pageAccessToken: string;
    instagramAccountId: string;
    instagramUsername?: string;
  }>;
};

function initFacebookSdk(appId: string) {
  window.FB?.init({
    appId,
    cookie: true,
    xfbml: true,
    version: FB_SDK_VERSION,
    fedCM: false,
  });
}

interface InstagramLoginLauncherProps {
  botId: string;
  alreadyConnected?: boolean;
  onConnected: (data: {
    instagramPageId: string;
    instagramAccountId?: string;
    pageName?: string;
    instagramUsername?: string;
  }) => void;
  className?: string;
}

export function InstagramLoginLauncher({
  botId,
  alreadyConnected = false,
  onConnected,
  className,
}: InstagramLoginLauncherProps) {
  const t = useT();
  const { data: metaAppConfig, isLoading: metaAppLoading } = useMetaAppConfig();
  const [sdkReady, setSdkReady] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [localConnected, setLocalConnected] = useState(alreadyConnected);
  const [error, setError] = useState("");
  const [pages, setPages] = useState<NonNullable<ConnectResponse["pages"]>>([]);

  const metaAppId = metaAppConfig?.appId?.trim() || FALLBACK_META_APP_ID;
  const configId = FALLBACK_CONFIG_ID.trim();
  const isConfigured = Boolean(metaAppId);

  useEffect(() => {
    if (!metaAppId || !window.FB) return;
    initFacebookSdk(metaAppId);
    setSdkReady(true);
  }, [metaAppId]);

  const completeWithPayload = useCallback(
    async (payload: Record<string, unknown>) => {
      setConnecting(true);
      setError("");
      try {
        const result = await api.post<ConnectResponse>("/instagram/connect", {
          botId,
          ...payload,
        });

        if (result.needsSelection && result.pages?.length) {
          setPages(result.pages);
          return;
        }

        if (!result.connected || !result.instagramPageId) {
          throw new Error(t("instagram.connectError"));
        }

        setPages([]);
        setLocalConnected(true);
        onConnected({
          instagramPageId: result.instagramPageId,
          ...(result.instagramAccountId ? { instagramAccountId: result.instagramAccountId } : {}),
          ...(result.pageName ? { pageName: result.pageName } : {}),
          ...(result.instagramUsername ? { instagramUsername: result.instagramUsername } : {}),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : t("instagram.connectError"));
      } finally {
        setConnecting(false);
      }
    },
    [botId, onConnected, t]
  );

  const handleLaunch = useCallback(() => {
    if (!window.FB || !sdkReady || !metaAppId || connecting) return;

    setConnecting(true);
    setError("");
    setPages([]);

    const loginOptions: Record<string, unknown> = configId
      ? {
          config_id: configId,
          response_type: "code",
          override_default_response_type: true,
        }
      : {
          scope: INSTAGRAM_LOGIN_SCOPES,
          return_scopes: true,
          enable_profile_selector: true,
        };

    window.FB.login((response) => {
      if (response.status === "connected" && response.authResponse?.code) {
        void completeWithPayload({ code: response.authResponse.code });
        return;
      }

      if (response.status === "connected" && response.authResponse?.accessToken) {
        void completeWithPayload({ userAccessToken: response.authResponse.accessToken });
        return;
      }

      setConnecting(false);
      if (response.status !== "connected") {
        setError(t("instagram.loginCancelled"));
      }
    }, loginOptions);
  }, [completeWithPayload, configId, connecting, metaAppId, sdkReady, t]);

  const handleSelectPage = useCallback(
    (page: NonNullable<ConnectResponse["pages"]>[number]) => {
      void completeWithPayload({
        pageAccessToken: page.pageAccessToken,
        pageId: page.pageId,
        instagramAccountId: page.instagramAccountId,
      });
    },
    [completeWithPayload]
  );

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
        {t("instagram.notConfigured")}
      </div>
    );
  }

  const showConnected = !connecting && localConnected && pages.length === 0;

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

      {connecting ? (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-3 rounded-lg border border-pink-200 bg-pink-50 px-4 py-3"
        >
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-pink-600" />
          <div>
            <p className="text-sm font-medium text-primary">{t("instagram.connecting")}</p>
            <p className="text-xs text-secondary">{t("instagram.connectingHint")}</p>
          </div>
        </div>
      ) : showConnected ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-green-700">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{t("instagram.loginConnected")}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setLocalConnected(false);
              handleLaunch();
            }}
            disabled={!sdkReady}
            className="text-xs font-medium text-accent hover:text-accent"
          >
            {t("instagram.reconnect")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleLaunch}
          disabled={!sdkReady}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-colors",
            !sdkReady ? "bg-pink-400/60 cursor-not-allowed" : "bg-pink-600 hover:bg-pink-700"
          )}
        >
          <Camera className="w-4 h-4" />
          {t("instagram.connectWithMeta")}
        </button>
      )}

      {pages.length > 0 && (
        <div className="rounded-lg border border-default bg-surface p-3 space-y-2">
          <p className="text-sm font-medium text-primary">{t("instagram.selectPage")}</p>
          <p className="text-xs text-secondary">{t("instagram.selectPageHint")}</p>
          <div className="space-y-2">
            {pages.map((page) => (
              <button
                key={page.pageId}
                type="button"
                onClick={() => handleSelectPage(page)}
                disabled={connecting}
                className="w-full rounded-lg border border-default px-3 py-2 text-left text-sm hover:bg-surface-elevated disabled:opacity-50"
              >
                <span className="font-medium text-primary">{page.pageName}</span>
                <span className="block text-xs text-secondary">
                  {page.instagramUsername
                    ? `@${page.instagramUsername}`
                    : page.instagramAccountId}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!sdkReady && <p className="text-xs text-muted">{t("instagram.sdkLoading")}</p>}

      {error ? (
        <IntegrationErrorSupport
          integration="instagram"
          error={error}
          context={{ flow: "facebook_login_for_business", botId }}
        />
      ) : null}
    </div>
  );
}
