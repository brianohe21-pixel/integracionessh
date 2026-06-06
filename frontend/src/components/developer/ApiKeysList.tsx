"use client";

import { useState } from "react";
import { Key, Trash2, ToggleLeft, ToggleRight, Clock, Bot } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useUpdateApiKey, useDeleteApiKey } from "@/hooks/useApiKeys";
import type { ApiKey } from "@/types";

interface ApiKeysListProps {
  keys: ApiKey[];
  bots: Array<{ botId: string; name: string }>;
}

export function ApiKeysList({ keys, bots }: ApiKeysListProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const updateKey = useUpdateApiKey();
  const deleteKey = useDeleteApiKey();

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

  async function handleDelete(keyId: string) {
    await deleteKey.mutateAsync(keyId);
    setConfirmDelete(null);
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

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
            <th className="px-6 py-3 font-medium">Name</th>
            <th className="px-6 py-3 font-medium">Key prefix</th>
            <th className="px-6 py-3 font-medium">Bot</th>
            <th className="px-6 py-3 font-medium">Status</th>
            <th className="px-6 py-3 font-medium">Last used</th>
            <th className="px-6 py-3 font-medium">Created</th>
            <th className="px-6 py-3 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {keys.map((key) => (
            <tr key={key.keyId} className="hover:bg-gray-50/50">
              <td className="px-6 py-3.5 font-medium text-gray-900">{key.name}</td>
              <td className="px-6 py-3.5">
                <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-700">
                  {key.prefix}…
                </code>
              </td>
              <td className="px-6 py-3.5">
                <span className="flex items-center gap-1.5 text-gray-600">
                  <Bot className="w-3.5 h-3.5 flex-shrink-0" />
                  {botName(key.botId)}
                </span>
              </td>
              <td className="px-6 py-3.5">
                <Badge variant={key.enabled ? "success" : "default"}>
                  {key.enabled ? "Active" : "Disabled"}
                </Badge>
              </td>
              <td className="px-6 py-3.5 text-gray-500">
                {key.lastUsedAt ? (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(key.lastUsedAt)}
                  </span>
                ) : (
                  <span className="text-gray-300">Never</span>
                )}
              </td>
              <td className="px-6 py-3.5 text-gray-500">{formatDate(key.createdAt)}</td>
              <td className="px-6 py-3.5">
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={() => handleToggle(key)}
                    disabled={updateKey.isPending}
                    title={key.enabled ? "Disable key" : "Enable key"}
                    className="text-gray-400 hover:text-indigo-600 transition-colors disabled:opacity-40"
                  >
                    {key.enabled ? (
                      <ToggleRight className="w-5 h-5 text-indigo-500" />
                    ) : (
                      <ToggleLeft className="w-5 h-5" />
                    )}
                  </button>

                  {confirmDelete === key.keyId ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleDelete(key.keyId)}
                        disabled={deleteKey.isPending}
                        className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-40"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(key.keyId)}
                      title="Revoke key"
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
