"use client";

import { useEffect, useState } from "react";
import { Plus, RefreshCw, Trash2, Users } from "lucide-react";
import {
  useMailrelayConfig,
  useMailrelayGroups,
  useMailrelaySenders,
  useMailrelaySyncs,
  useSaveMailrelayConfig,
  useStartMailrelaySync,
} from "@/hooks/useMailrelay";
import { useT } from "@/i18n/context";
import type { MailrelayConfig, MailrelayTagGroupMapping } from "@/types";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";

const emptyConfig: MailrelayConfig = {
  senderId: "",
  defaultGroupId: "",
  tagGroupMappings: [],
};

export function MailrelayAudienceTab({ connected }: { connected: boolean }) {
  const t = useT();
  const configQuery = useMailrelayConfig(connected);
  const groupsQuery = useMailrelayGroups(connected);
  const sendersQuery = useMailrelaySenders(connected);
  const syncsQuery = useMailrelaySyncs(connected);
  const saveConfig = useSaveMailrelayConfig();
  const startSync = useStartMailrelaySync();
  const [config, setConfig] = useState<MailrelayConfig>(emptyConfig);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (configQuery.data?.config) setConfig(configQuery.data.config);
  }, [configQuery.data]);

  if (!connected) {
    return (
      <EmptyState
        icon={<Users className="h-6 w-6" />}
        title={t("mailrelay.states.connectionRequired")}
        description={t("mailrelay.states.connectionRequiredDescription")}
      />
    );
  }

  const groups = groupsQuery.data?.groups ?? [];
  const senders = sendersQuery.data?.senders ?? [];
  const syncs = syncsQuery.data?.syncs ?? [];
  const activeSync = syncs.find((sync) => sync.status === "pending" || sync.status === "running");
  const queryError =
    configQuery.error ?? groupsQuery.error ?? sendersQuery.error ?? syncsQuery.error;

  function updateMapping(index: number, patch: Partial<MailrelayTagGroupMapping>) {
    setConfig((current) => ({
      ...current,
      tagGroupMappings: current.tagGroupMappings.map((mapping, mappingIndex) =>
        mappingIndex === index ? { ...mapping, ...patch } : mapping
      ),
    }));
    setSaved(false);
  }

  async function handleSave() {
    if (!config.senderId || !config.defaultGroupId) {
      setError(t("mailrelay.validation.senderAudience"));
      return;
    }
    if (config.tagGroupMappings.some((mapping) => !mapping.tag.trim() || !mapping.groupId)) {
      setError(t("mailrelay.validation.mapping"));
      return;
    }
    try {
      setError("");
      await saveConfig.mutateAsync(config);
      setSaved(true);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function handleSync() {
    try {
      setError("");
      await startSync.mutateAsync();
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  if (configQuery.isLoading || groupsQuery.isLoading || sendersQuery.isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (queryError) {
    return <Alert variant="danger">{queryError.message}</Alert>;
  }

  return (
    <div className="space-y-6">
      <Card padding="lg" className="space-y-5">
        <div>
          <h2 className="font-semibold text-primary">{t("mailrelay.audience.settingsTitle")}</h2>
          <p className="mt-1 text-sm text-secondary">
            {t("mailrelay.audience.settingsDescription")}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm font-medium text-primary">
            <span>{t("mailrelay.audience.sender")}</span>
            <Select
              value={config.senderId}
              onChange={(event) => {
                setConfig((current) => ({ ...current, senderId: event.target.value }));
                setSaved(false);
              }}
            >
              <option value="">{t("mailrelay.audience.selectSender")}</option>
              {senders.map((sender) => (
                <option key={sender.id} value={sender.id}>
                  {sender.name} ({sender.email})
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-2 text-sm font-medium text-primary">
            <span>{t("mailrelay.audience.defaultGroup")}</span>
            <Select
              value={config.defaultGroupId}
              onChange={(event) => {
                setConfig((current) => ({ ...current, defaultGroupId: event.target.value }));
                setSaved(false);
              }}
            >
              <option value="">{t("mailrelay.audience.selectGroup")}</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </Select>
          </label>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-primary">
                {t("mailrelay.audience.mappingTitle")}
              </h3>
              <p className="text-xs text-secondary">{t("mailrelay.audience.mappingDescription")}</p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                setConfig((current) => ({
                  ...current,
                  tagGroupMappings: [...current.tagGroupMappings, { tag: "", groupId: "" }],
                }))
              }
            >
              <Plus className="h-4 w-4" />
              {t("mailrelay.actions.add")}
            </Button>
          </div>
          {config.tagGroupMappings.length === 0 ? (
            <p className="rounded-lg bg-surface-muted p-3 text-sm text-secondary">
              {t("mailrelay.audience.noMappings")}
            </p>
          ) : (
            config.tagGroupMappings.map((mapping, index) => (
              <div
                key={`${index}-${mapping.groupId}`}
                className="grid gap-2 rounded-lg border border-default p-3 sm:grid-cols-[1fr_1fr_auto]"
              >
                <Input
                  value={mapping.tag}
                  onChange={(event) => updateMapping(index, { tag: event.target.value })}
                  placeholder={t("mailrelay.audience.tagPlaceholder")}
                />
                <Select
                  value={mapping.groupId}
                  onChange={(event) => updateMapping(index, { groupId: event.target.value })}
                >
                  <option value="">{t("mailrelay.audience.selectGroup")}</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </Select>
                <Button
                  variant="ghost"
                  onClick={() =>
                    setConfig((current) => ({
                      ...current,
                      tagGroupMappings: current.tagGroupMappings.filter(
                        (_, mappingIndex) => mappingIndex !== index
                      ),
                    }))
                  }
                  aria-label={t("mailrelay.actions.delete")}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>

        {error ? <Alert variant="danger">{error}</Alert> : null}
        {saved ? <Alert variant="success">{t("mailrelay.audience.saved")}</Alert> : null}
        <Button onClick={() => void handleSave()} disabled={saveConfig.isPending}>
          {saveConfig.isPending ? t("mailrelay.actions.saving") : t("mailrelay.actions.save")}
        </Button>
      </Card>

      <Card padding="lg" className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-primary">{t("mailrelay.audience.syncTitle")}</h2>
            <p className="mt-1 text-sm text-secondary">
              {t("mailrelay.audience.syncDescription")}
            </p>
          </div>
          <Button
            onClick={() => void handleSync()}
            disabled={startSync.isPending || Boolean(activeSync)}
          >
            <RefreshCw className={`h-4 w-4 ${activeSync ? "animate-spin" : ""}`} />
            {activeSync ? t("mailrelay.audience.syncing") : t("mailrelay.audience.sync")}
          </Button>
        </div>

        {activeSync ? (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-secondary">
              <span>{t("mailrelay.audience.progress")}</span>
              <span>{Math.max(0, Math.min(100, activeSync.progress))}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${Math.max(0, Math.min(100, activeSync.progress))}%` }}
              />
            </div>
          </div>
        ) : null}

        {syncs.length === 0 ? (
          <p className="text-sm text-secondary">{t("mailrelay.audience.noSyncs")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-muted">
                <tr>
                  <th className="px-3 py-2">{t("mailrelay.audience.date")}</th>
                  <th className="px-3 py-2">{t("mailrelay.audience.status")}</th>
                  <th className="px-3 py-2">{t("mailrelay.audience.processed")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {syncs.map((sync) => (
                  <tr key={sync.id}>
                    <td className="px-3 py-3 text-primary">
                      {new Date(sync.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-3">
                      <Badge
                        variant={
                          sync.status === "completed"
                            ? "success"
                            : sync.status === "failed"
                              ? "danger"
                              : "info"
                        }
                      >
                        {t(`mailrelay.syncStatus.${sync.status}`)}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-secondary">
                      {sync.processed} / {sync.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
