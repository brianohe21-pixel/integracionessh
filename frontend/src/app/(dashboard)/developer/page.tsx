"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound, BarChart3, Plus, Webhook, BookOpen } from "lucide-react";
import { IntegrationWebhooksPanel } from "@/components/developer/IntegrationWebhooksPanel";
import { useApiKeys } from "@/hooks/useApiKeys";
import { ApiKeysList } from "@/components/developer/ApiKeysList";
import { ApiUsageChart } from "@/components/developer/ApiUsageChart";
import { CreateApiKeyModal } from "@/components/developer/CreateApiKeyModal";
import { useBots } from "@/hooks/useBots";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { useT } from "@/i18n/context";

type Tab = "keys" | "usage" | "webhooks";

export default function DeveloperPage() {
  const t = useT();
  const [tab, setTab] = useState<Tab>("keys");
  const [showCreate, setShowCreate] = useState(false);

  const { data: keys = [], isLoading: keysLoading, error: keysError } = useApiKeys();
  const { data: botsData } = useBots();
  const bots = (botsData ?? []).map((b) => ({ botId: b.botId, name: b.name }));

  const isLoading = tab === "keys" ? keysLoading : false;
  const error = tab === "keys" ? keysError : null;

  return (
    <DashboardPage>
      <PageHeader
        title="Developer API"
        subtitle="Manage API keys and monitor message usage from your integrations."
        actions={
          tab === "keys" ? (
            <>
              <Link
                href="/docs/api"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-secondary bg-surface-muted rounded-lg hover:bg-gray-200 transition-colors"
              >
                <BookOpen className="w-4 h-4" />
                {t("apiDocs.viewDocs")}
              </Link>
              <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent-hover transition-colors"
            >
              <Plus className="w-4 h-4" />
              New API key
            </button>
            </>
          ) : undefined
        }
      />

      <div className="flex gap-1 mb-6 border-b border-default">
        <button
          onClick={() => setTab("keys")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === "keys"
              ? "border-accent text-accent"
              : "border-transparent text-secondary hover:text-secondary"
          }`}
        >
          <KeyRound className="w-4 h-4" />
          API Keys
          {keys.length > 0 && (
            <span className="ml-1 bg-surface-muted text-secondary text-xs px-1.5 py-0.5 rounded-full">
              {keys.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("usage")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === "usage"
              ? "border-accent text-accent"
              : "border-transparent text-secondary hover:text-secondary"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Usage & Metrics
        </button>
        <button
          onClick={() => setTab("webhooks")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === "webhooks"
              ? "border-accent text-accent"
              : "border-transparent text-secondary hover:text-secondary"
          }`}
        >
          <Webhook className="w-4 h-4" />
          Webhooks
        </button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-surface-elevated rounded-xl border border-default p-5 animate-pulse h-14" />
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-600 font-medium">Failed to load data</p>
          <p className="text-xs text-red-500 mt-1">{(error as Error).message}</p>
        </div>
      )}

      {tab === "webhooks" && (
        <div className="bg-surface-elevated rounded-xl border border-default overflow-hidden">
          <IntegrationWebhooksPanel />
        </div>
      )}

      {!isLoading && !error && tab !== "webhooks" && (
        <div className="bg-surface-elevated rounded-xl border border-default overflow-hidden">
          {tab === "keys" && <ApiKeysList keys={keys} bots={bots} />}
          {tab === "usage" && (
            <div className="p-6">
              <ApiUsageChart />
            </div>
          )}
        </div>
      )}

      {showCreate && bots.length > 0 && (
        <CreateApiKeyModal bots={bots} onClose={() => setShowCreate(false)} />
      )}

      {showCreate && bots.length === 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-surface-elevated rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
            <p className="text-base font-semibold text-primary mb-2">No bots configured</p>
            <p className="text-sm text-secondary mb-6">
              You need at least one active bot before creating an API key.
            </p>
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent-hover"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </DashboardPage>
  );
}
