"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  Clock,
  Gauge,
  Mail,
  Megaphone,
  Phone,
  Save,
  ShieldAlert,
  Signal,
  Timer,
  Webhook,
} from "lucide-react";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import {
  useMarkAllOpsAlertsRead,
  useMarkOpsAlertRead,
  useOpsAlertsHistory,
  useOpsAlertsSettings,
  useSaveOpsAlertsSettings,
} from "@/hooks/useOpsAlerts";
import { usePermissions } from "@/hooks/usePermissions";
import { useFormatters } from "@/hooks/useFormatters";
import { DEFAULT_OPS_ALERTS, resolveOpsAlertsSettings } from "@/lib/ops-alerts";
import { useT } from "@/i18n/context";
import type {
  OpsAlert,
  OpsAlertRuleId,
  OpsAlertRuleSettings,
  OpsAlertSeverity,
  OpsAlertsSettings,
} from "@/types";
import { cn } from "@/lib/utils";

const RULE_LABEL_KEYS: Record<OpsAlertRuleId, string> = {
  sla_breached: "opsAlerts.rules.sla_breached",
  webhook_failed: "opsAlerts.rules.webhook_failed",
  campaign_stopped: "opsAlerts.rules.campaign_stopped",
  whatsapp_quality: "opsAlerts.rules.whatsapp_quality",
  plan_usage: "opsAlerts.rules.plan_usage",
  telephony_spend: "opsAlerts.rules.telephony_spend",
  channel_down: "opsAlerts.rules.channel_down",
};

const RULE_DESC_KEYS: Record<OpsAlertRuleId, string> = {
  sla_breached: "opsAlerts.rules.sla_breachedDesc",
  webhook_failed: "opsAlerts.rules.webhook_failedDesc",
  campaign_stopped: "opsAlerts.rules.campaign_stoppedDesc",
  whatsapp_quality: "opsAlerts.rules.whatsapp_qualityDesc",
  plan_usage: "opsAlerts.rules.plan_usageDesc",
  telephony_spend: "opsAlerts.rules.telephony_spendDesc",
  channel_down: "opsAlerts.rules.channel_downDesc",
};

const RULE_ICONS: Record<OpsAlertRuleId, typeof Bell> = {
  sla_breached: Timer,
  webhook_failed: Webhook,
  campaign_stopped: Megaphone,
  whatsapp_quality: ShieldAlert,
  plan_usage: Gauge,
  telephony_spend: Phone,
  channel_down: Signal,
};

type PageTab = "rules" | "history";

function Toggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors",
        checked ? "bg-accent" : "bg-surface-muted",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-5 w-5 rounded-full bg-surface-elevated shadow transition",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}

function ChannelOption({
  active,
  disabled,
  onClick,
  icon,
  label,
  hint,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <div
      className={cn(
        "flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5",
        active ? "border-accent/30 bg-accent/10" : "border-subtle bg-surface",
        disabled && "opacity-50"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
          active ? "bg-accent/15 text-accent" : "bg-surface-muted text-muted"
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-xs font-semibold",
            active ? "text-accent" : "text-primary"
          )}
        >
          {label}
        </p>
        <p className="mt-0.5 text-[11px] leading-snug text-secondary">{hint}</p>
      </div>
      <Toggle
        checked={active}
        disabled={disabled}
        onChange={() => onClick()}
        label={label}
      />
    </div>
  );
}

function severityClasses(severity: OpsAlertSeverity): string {
  if (severity === "critical") return "bg-danger";
  if (severity === "warning") return "bg-warning";
  return "bg-info";
}

function severityBadgeVariant(
  severity: OpsAlertSeverity
): "danger" | "warning" | "info" {
  if (severity === "critical") return "danger";
  if (severity === "warning") return "warning";
  return "info";
}

function RuleCard({
  rule,
  canManage,
  onChange,
}: {
  rule: OpsAlertRuleSettings;
  canManage: boolean;
  onChange: (patch: Partial<OpsAlertRuleSettings>) => void;
}) {
  const t = useT();
  const Icon = RULE_ICONS[rule.id];

  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-xl border p-4 transition-colors",
        rule.enabled
          ? "border-accent/25 bg-surface-elevated"
          : "border-subtle bg-surface-muted/30"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            rule.enabled ? "bg-accent/10 text-accent" : "bg-surface-muted text-muted"
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <Toggle
          checked={rule.enabled}
          disabled={!canManage}
          onChange={(checked) => onChange({ enabled: checked })}
          label={t("opsAlerts.enableRule")}
        />
      </div>

      <div className="mt-3 min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-primary">{t(RULE_LABEL_KEYS[rule.id])}</p>
          <Badge variant={rule.enabled ? "success" : "default"}>
            {rule.enabled ? t("opsAlerts.enabled") : t("opsAlerts.disabled")}
          </Badge>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-secondary">
          {t(RULE_DESC_KEYS[rule.id])}
        </p>
      </div>

      {rule.enabled ? (
        <div className="mt-4 space-y-2 border-t border-subtle pt-3">
          <ChannelOption
            active={rule.inApp}
            disabled={!canManage}
            onClick={() => onChange({ inApp: !rule.inApp })}
            icon={<Bell className="h-3.5 w-3.5" />}
            label={t("opsAlerts.channelInAppShort")}
            hint={t("opsAlerts.channelInAppHint")}
          />
          <ChannelOption
            active={rule.email}
            disabled={!canManage}
            onClick={() => onChange({ email: !rule.email })}
            icon={<Mail className="h-3.5 w-3.5" />}
            label={t("opsAlerts.channelEmailShort")}
            hint={t("opsAlerts.channelEmailHint")}
          />

          {rule.id === "plan_usage" ? (
            <label className="flex w-full items-center gap-2 pt-1">
              <span className="text-xs text-secondary">
                {t("opsAlerts.thresholdPercentShort")}
              </span>
              <Input
                type="number"
                min={1}
                max={100}
                value={rule.thresholdPercent ?? 85}
                onChange={(e) => onChange({ thresholdPercent: Number(e.target.value) })}
                disabled={!canManage}
                className="h-8 w-20"
              />
              <span className="text-xs text-muted">%</span>
            </label>
          ) : null}

          {rule.id === "telephony_spend" ? (
            <label className="flex w-full items-center gap-2 pt-1">
              <span className="text-xs text-secondary">
                {t("opsAlerts.thresholdUsdShort")}
              </span>
              <Input
                type="number"
                min={1}
                step="0.01"
                value={rule.thresholdUsd ?? 50}
                onChange={(e) => onChange({ thresholdUsd: Number(e.target.value) })}
                disabled={!canManage}
                className="h-8 w-24"
              />
              <span className="text-xs text-muted">USD</span>
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function HistoryItem({
  alert,
  marking,
  onMarkRead,
}: {
  alert: OpsAlert;
  marking: boolean;
  onMarkRead: () => void;
}) {
  const t = useT();
  const { formatRelativeTime } = useFormatters();
  const Icon = RULE_ICONS[alert.ruleId] ?? AlertTriangle;
  const unread = !alert.readAt;

  return (
    <li
      className={cn(
        "relative overflow-hidden rounded-xl border transition-colors",
        unread
          ? "border-accent/25 bg-accent/[0.04]"
          : "border-subtle bg-surface-elevated"
      )}
    >
      <div className={cn("absolute inset-y-0 left-0 w-1", severityClasses(alert.severity))} />
      <div className="flex flex-col gap-3 p-4 pl-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
              unread ? "bg-accent/10 text-accent" : "bg-surface-muted text-muted"
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-primary">{alert.title}</p>
              {unread ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-accent">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  {t("notifications.unread")}
                </span>
              ) : null}
            </div>
            <p className="text-sm leading-relaxed text-secondary">{alert.body}</p>
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <Badge variant={severityBadgeVariant(alert.severity)}>
                {t(`opsAlerts.severity.${alert.severity}`)}
              </Badge>
              <Badge variant="default">{t(RULE_LABEL_KEYS[alert.ruleId])}</Badge>
              <span className="inline-flex items-center gap-1 text-xs text-muted">
                <Clock className="h-3 w-3" />
                {formatRelativeTime(alert.createdAt)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 self-end sm:self-start">
          <Link
            href={alert.href || "/alerts"}
            className="inline-flex items-center justify-center rounded-lg border border-field-border bg-surface-elevated px-3 py-1.5 text-xs font-medium text-primary shadow-sm transition-colors hover:bg-surface-muted"
          >
            {t("opsAlerts.open")}
          </Link>
          {unread ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={marking}
              onClick={onMarkRead}
            >
              {t("opsAlerts.markRead")}
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export default function AlertsPage() {
  const t = useT();
  const { can, loading: permissionsLoading } = usePermissions();
  const canRead = can("settings.read");
  const canManage = can("settings.manage");

  const { data: settings, isLoading: settingsLoading } = useOpsAlertsSettings();
  const { data: history = [], isLoading: historyLoading } = useOpsAlertsHistory();
  const save = useSaveOpsAlertsSettings();
  const markRead = useMarkOpsAlertRead();
  const markAll = useMarkAllOpsAlertsRead();

  const [tab, setTab] = useState<PageTab>("rules");
  const [draft, setDraft] = useState<OpsAlertsSettings>(DEFAULT_OPS_ALERTS);
  const [recipientsText, setRecipientsText] = useState("");
  const [baseline, setBaseline] = useState({
    recipients: "",
    rules: DEFAULT_OPS_ALERTS.rules,
  });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!settings) return;
    const resolved = resolveOpsAlertsSettings(settings);
    const recipients = resolved.emailRecipients.join(", ");
    setDraft(resolved);
    setRecipientsText(recipients);
    setBaseline({ recipients, rules: resolved.rules });
  }, [settings]);

  const enabledCount = useMemo(
    () => draft.rules.filter((rule) => rule.enabled).length,
    [draft.rules]
  );
  const unreadCount = useMemo(
    () => history.filter((item) => !item.readAt).length,
    [history]
  );
  const emailEnabledCount = useMemo(
    () => draft.rules.filter((rule) => rule.enabled && rule.email).length,
    [draft.rules]
  );

  const dirty = useMemo(() => {
    if (recipientsText.trim() !== baseline.recipients.trim()) return true;
    return JSON.stringify(draft.rules) !== JSON.stringify(baseline.rules);
  }, [baseline, draft.rules, recipientsText]);

  function updateRule(id: OpsAlertRuleId, patch: Partial<OpsAlertRuleSettings>) {
    setDraft((current) => ({
      ...current,
      rules: current.rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)),
    }));
    setSaved(false);
  }

  async function handleSave(e?: React.FormEvent) {
    e?.preventDefault();
    if (!canManage || !dirty) return;
    setError("");
    setSaved(false);

    const emailRecipients = recipientsText
      .split(/[,;\s]+/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    try {
      const next = await save.mutateAsync({
        emailRecipients,
        rules: draft.rules,
      });
      const resolved = resolveOpsAlertsSettings(next);
      const recipients = resolved.emailRecipients.join(", ");
      setDraft(resolved);
      setRecipientsText(recipients);
      setBaseline({ recipients, rules: resolved.rules });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("opsAlerts.saveError"));
    }
  }

  if (permissionsLoading || settingsLoading) {
    return (
      <DashboardPage>
        <PageHeader title={t("opsAlerts.title")} subtitle={t("opsAlerts.subtitle")} />
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </DashboardPage>
    );
  }

  if (!canRead) {
    return (
      <DashboardPage>
        <PageHeader title={t("opsAlerts.title")} subtitle={t("opsAlerts.subtitle")} />
        <EmptyState
          icon={<Bell className="h-6 w-6" />}
          title={t("opsAlerts.noAccess")}
          description={t("opsAlerts.noAccessHint")}
        />
      </DashboardPage>
    );
  }

  return (
    <DashboardPage className="pb-24">
      <PageHeader
        title={t("opsAlerts.title")}
        subtitle={t("opsAlerts.subtitle")}
        actions={
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { id: "rules", label: t("opsAlerts.tabRules"), count: enabledCount },
              { id: "history", label: t("opsAlerts.tabHistory"), count: unreadCount },
            ]}
          />
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card padding="md" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <Bell className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs text-secondary">{t("opsAlerts.statActive")}</p>
            <p className="text-lg font-semibold tabular-nums text-primary">
              {enabledCount}
              <span className="text-sm font-normal text-muted"> / {draft.rules.length}</span>
            </p>
          </div>
        </Card>
        <Card padding="md" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10 text-warning">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs text-secondary">{t("opsAlerts.statUnread")}</p>
            <p className="text-lg font-semibold tabular-nums text-primary">{unreadCount}</p>
          </div>
        </Card>
        <Card padding="md" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-info/10 text-info">
            <Mail className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs text-secondary">{t("opsAlerts.statEmailRules")}</p>
            <p className="text-lg font-semibold tabular-nums text-primary">{emailEnabledCount}</p>
          </div>
        </Card>
      </div>

      {tab === "rules" ? (
        <form onSubmit={handleSave} className="space-y-5">
          <Card padding="md">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <Mail className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-primary">
                  {t("opsAlerts.emailRecipientsTitle")}
                </p>
                <p className="mt-0.5 text-sm text-secondary">
                  {t("opsAlerts.emailRecipientsDescription")}
                </p>
                <Input
                  value={recipientsText}
                  onChange={(e) => {
                    setRecipientsText(e.target.value);
                    setSaved(false);
                  }}
                  placeholder={t("opsAlerts.emailRecipientsPlaceholder")}
                  disabled={!canManage}
                  className="mt-3"
                />
              </div>
            </div>
          </Card>

          <div>
            <div className="mb-3">
              <p className="text-sm font-semibold text-primary">{t("opsAlerts.rulesTitle")}</p>
              <p className="mt-0.5 text-sm text-secondary">{t("opsAlerts.rulesSubtitle")}</p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {draft.rules.map((rule) => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  canManage={canManage}
                  onChange={(patch) => updateRule(rule.id, patch)}
                />
              ))}
            </div>
          </div>

          {canManage ? (
            <div className="sticky bottom-4 z-10">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-default bg-surface-elevated/95 px-4 py-3 shadow-[var(--shadow-md)] backdrop-blur">
                <div className="min-w-0 text-sm">
                  {error ? (
                    <span className="text-danger">{error}</span>
                  ) : saved && !dirty ? (
                    <span className="text-success">{t("opsAlerts.saved")}</span>
                  ) : dirty ? (
                    <span className="text-secondary">{t("opsAlerts.unsavedChanges")}</span>
                  ) : (
                    <span className="text-muted">{t("opsAlerts.allSaved")}</span>
                  )}
                </div>
                <Button type="submit" disabled={save.isPending || !dirty}>
                  <Save className="h-4 w-4" />
                  {save.isPending ? t("common.saving") : t("common.save")}
                </Button>
              </div>
            </div>
          ) : null}
        </form>
      ) : (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-primary">{t("opsAlerts.historyTitle")}</h2>
              <p className="mt-0.5 text-sm text-secondary">{t("opsAlerts.historySubtitle")}</p>
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={markAll.isPending || unreadCount === 0}
              onClick={() => markAll.mutate()}
            >
              <CheckCheck className="h-4 w-4" />
              {t("opsAlerts.markAllRead")}
            </Button>
          </div>

          {historyLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
            </div>
          ) : history.length === 0 ? (
            <EmptyState
              icon={<Bell className="h-6 w-6" />}
              title={t("opsAlerts.historyEmpty")}
              description={t("opsAlerts.historyEmptyHint")}
              action={
                <Button type="button" variant="secondary" onClick={() => setTab("rules")}>
                  {t("opsAlerts.goToRules")}
                </Button>
              }
            />
          ) : (
            <ul className="space-y-2">
              {history.map((alert) => (
                <HistoryItem
                  key={alert.alertId}
                  alert={alert}
                  marking={markRead.isPending}
                  onMarkRead={() => markRead.mutate(alert.alertId)}
                />
              ))}
            </ul>
          )}
        </section>
      )}
    </DashboardPage>
  );
}
