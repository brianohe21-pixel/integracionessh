"use client";

import { useState } from "react";
import { Key, Clock, Bot } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useUpdateApiKey, useDeleteApiKey } from "@/hooks/useApiKeys";
import type { ApiKey } from "@/types";
import { TableContainer } from "@/components/ui/TableContainer";
import { getSelectedOptionalScopes } from "@/lib/api-key-scopes";
import { ApiKeyScopesModal } from "@/components/developer/ApiKeyScopesModal";
import { ApiKeyActionsMenu } from "@/components/developer/ApiKeyActionsMenu";
import { useT } from "@/i18n/context";

interface ApiKeysListProps {
  keys: ApiKey[];
  bots: Array<{ botId: string; name: string }>;
}

export function ApiKeysList({ keys, bots }: ApiKeysListProps) {
  const [revokeKey, setRevokeKey] = useState<ApiKey | null>(null);
  const [scopesKey, setScopesKey] = useState<ApiKey | null>(null);
  const updateKey = useUpdateApiKey();
  const deleteKey = useDeleteApiKey();
  const t = useT();

  function botName(botId: string): string {
    return bots.find((b) => b.botId === botId)?.name ?? botId;
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  async function handleToggle(key: ApiKey) {
    await updateKey.mutateAsync({ keyId: key.keyId, enabled: !key.enabled });
  }

  async function handleDelete() {
    if (!revokeKey) return;
    await deleteKey.mutateAsync(revokeKey.keyId);
    setRevokeKey(null);
  }

  if (keys.length === 0) {
    return (
      <EmptyState
        icon={<Key className="w-6 h-6" />}
        title="No API keys yet"
        description="Create your first API key to start sending WhatsApp messages programmatically."
      />
    );
  }

  const busy = updateKey.isPending || deleteKey.isPending;

  return (
    <TableContainer>
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="bg-surface text-left text-xs text-secondary uppercase tracking-wide">
            <th className="px-6 py-3 font-medium">Name</th>
            <th className="px-6 py-3 font-medium">Key prefix</th>
            <th className="px-6 py-3 font-medium">Bot</th>
            <th className="px-6 py-3 font-medium">Scopes</th>
            <th className="px-6 py-3 font-medium">Status</th>
            <th className="px-6 py-3 font-medium">Last used</th>
            <th className="px-6 py-3 font-medium">Created</th>
            <th className="px-6 py-3 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {keys.map((key) => (
            <tr key={key.keyId} className="hover:bg-surface/50">
              <td className="px-6 py-3.5 font-medium text-primary">{key.name}</td>
              <td className="px-6 py-3.5">
                <code className="text-xs bg-surface-muted px-2 py-1 rounded font-mono text-secondary">
                  {key.prefix}…
                </code>
              </td>
              <td className="px-6 py-3.5">
                <span className="flex items-center gap-1.5 text-secondary">
                  <Bot className="w-3.5 h-3.5 flex-shrink-0" />
                  {botName(key.botId)}
                </span>
              </td>
              <td className="px-6 py-3.5">
                <div className="flex flex-wrap gap-1 max-w-[220px]">
                  {getSelectedOptionalScopes(key.scopes).length === 0 ? (
                    <span className="text-xs text-muted">{t("developer.noOptionalScopes")}</span>
                  ) : (
                    getSelectedOptionalScopes(key.scopes).map((scope) => (
                      <Badge key={scope} variant="default" className="text-[10px]">
                        {scope.replace("voice:calls:", "").replace("otp:", "")}
                      </Badge>
                    ))
                  )}
                </div>
              </td>
              <td className="px-6 py-3.5">
                <Badge variant={key.enabled ? "success" : "default"}>
                  {key.enabled ? "Active" : "Disabled"}
                </Badge>
              </td>
              <td className="px-6 py-3.5 text-secondary">
                {key.lastUsedAt ? (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(key.lastUsedAt)}
                  </span>
                ) : (
                  <span className="text-gray-300">Never</span>
                )}
              </td>
              <td className="px-6 py-3.5 text-secondary">{formatDate(key.createdAt)}</td>
              <td className="px-6 py-3.5">
                <div className="flex items-center justify-end">
                  <ApiKeyActionsMenu
                    enabled={key.enabled}
                    busy={busy}
                    onEditScopes={() => setScopesKey(key)}
                    onToggleEnabled={() => void handleToggle(key)}
                    onRevoke={() => setRevokeKey(key)}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {scopesKey && (
        <ApiKeyScopesModal apiKey={scopesKey} onClose={() => setScopesKey(null)} />
      )}

      <ConfirmDialog
        open={revokeKey !== null}
        title={t("developer.revokeKeyTitle")}
        description={t("developer.revokeKeyDescription", { name: revokeKey?.name ?? "" })}
        confirmLabel={t("developer.revokeKey")}
        tone="danger"
        loading={deleteKey.isPending}
        onConfirm={() => void handleDelete()}
        onCancel={() => setRevokeKey(null)}
      />
    </TableContainer>
  );
}
