"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, getTenantContext, setTenantContext } from "@/lib/api";
import { useT } from "@/i18n/context";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { TableContainer } from "@/components/ui/TableContainer";
import { Badge } from "@/components/ui/Badge";
import {
  useAssumeSubaccount,
  useClearTenantContext,
  useCreateSubaccount,
  useResellerDomain,
  useRegisterResellerDomain,
  useDeleteResellerDomain,
  useDeleteSubaccount,
  useSendSubaccountCredentials,
  useResellerSubaccounts,
  useUpdateSubaccount,
  type ResellerDomainDnsRecord,
} from "@/hooks/useReseller";
import type { ResellerLimitsOverride, SubaccountServiceId, Tenant } from "@/types";
import { useRouter } from "next/navigation";
import { MEMBER_HOME } from "@/lib/post-login-path";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useDialog } from "@/components/ui/DialogProvider";
import { Tabs } from "@/components/ui/Tabs";
import { Modal } from "@/components/ui/Modal";
import { ResellerBagPanel } from "@/components/reseller/ResellerBagPanel";
import { ResellerMetaAppPanel } from "@/components/reseller/ResellerMetaAppPanel";
import { SubaccountBillingPanel } from "@/components/reseller/SubaccountBillingPanel";
import { SubaccountActionsMenu } from "@/components/reseller/SubaccountActionsMenu";
import { SubaccountServicesFields } from "@/components/reseller/SubaccountServicesFields";
import { WhatsAppRiskBadge } from "@/components/whatsapp/WhatsAppRiskBadge";
import {
  SERVICE_NAV_KEYS,
  defaultEnabledServices,
  emptyServiceLimits,
} from "@/lib/subaccount-services";

function portalUrl(customDomain: string): string {
  const host = customDomain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `https://${host}`;
}

function cleanDnsToken(value: string): string {
  return value.trim().replace(/\.$/, "");
}

function normalizeDnsRecord(record: ResellerDomainDnsRecord): ResellerDomainDnsRecord {
  const types = new Set(["CNAME", "A", "AAAA", "TXT", "ALIAS"]);
  const name = (record.name ?? "").trim();
  const value = (record.value ?? "").trim();
  if (value && value.toLowerCase() !== "<pending>") {
    return {
      ...record,
      name: cleanDnsToken(name),
      value: cleanDnsToken(value),
      type: (record.type || "CNAME").toUpperCase(),
    };
  }

  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 3) {
    const first = parts[0]!.toUpperCase();
    const second = parts[1]!.toUpperCase();
    if (types.has(second)) {
      return {
        ...record,
        type: second,
        name: cleanDnsToken(parts[0]!),
        value: cleanDnsToken(parts.slice(2).join(" ")),
      };
    }
    if (types.has(first)) {
      return {
        ...record,
        type: first,
        name: cleanDnsToken(parts[1]!),
        value: cleanDnsToken(parts.slice(2).join(" ")),
      };
    }
  }

  return {
    ...record,
    name: cleanDnsToken(name),
    value: cleanDnsToken(value),
    type: (record.type || "CNAME").toUpperCase(),
  };
}

function dnsHostShort(name: string, customDomain: string | null | undefined): string {
  const host = cleanDnsToken(name).toLowerCase();
  const fqdn = cleanDnsToken(customDomain ?? "").toLowerCase();
  if (!fqdn) return host;
  const root = fqdn.split(".").slice(-2).join(".");
  if (host === fqdn || host === root) return "@";
  if (host.endsWith(`.${root}`)) return host.slice(0, -(root.length + 1));
  if (host.endsWith(`.${fqdn}`)) return host.slice(0, -(fqdn.length + 1));
  return host;
}

function DnsCopyField({
  label,
  value,
  hint,
  copyLabel,
  copiedLabel,
}: {
  label: string;
  value: string;
  hint?: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  const display = value.trim() || "—";

  async function copy() {
    if (!value.trim()) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-1">
      <div className="text-xs font-medium uppercase tracking-wide text-secondary">{label}</div>
      <div className="flex items-start gap-2">
        <code className="min-w-0 flex-1 break-all rounded-md bg-surface-muted px-2 py-1.5 text-xs text-primary">
          {display}
        </code>
        <button
          type="button"
          disabled={!value.trim()}
          onClick={() => void copy()}
          className="shrink-0 rounded-md border border-default px-2 py-1 text-xs text-secondary hover:bg-surface disabled:opacity-40"
        >
          {copied ? copiedLabel : copyLabel}
        </button>
      </div>
      {hint ? <p className="text-xs text-secondary">{hint}</p> : null}
    </div>
  );
}

function SubaccountServiceChips({
  services,
  t,
}: {
  services?: SubaccountServiceId[];
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const list = services ?? defaultEnabledServices();
  const catalogSize = defaultEnabledServices().length;
  if (list.length === catalogSize) {
    return <Badge variant="accent">{t("reseller.allServices")}</Badge>;
  }
  const shown = list.slice(0, 3);
  const extra = list.length - shown.length;
  return (
    <div className="flex max-w-[18rem] flex-wrap gap-1">
      {shown.map((id) => (
        <Badge key={id} variant="default">
          {t(SERVICE_NAV_KEYS[id])}
        </Badge>
      ))}
      {extra > 0 ? (
        <Badge variant="info">{t("reseller.moreServices", { count: String(extra) })}</Badge>
      ) : null}
    </div>
  );
}

function DnsRecordCard({
  record,
  customDomain,
  fallbackValue,
  t,
}: {
  record: ResellerDomainDnsRecord;
  customDomain: string | null | undefined;
  fallbackValue?: string;
  t: (key: string) => string;
}) {
  const normalized = normalizeDnsRecord(record);
  const host = normalized.name;
  const value =
    normalized.value && normalized.value.toLowerCase() !== "<pending>"
      ? normalized.value
      : cleanDnsToken(fallbackValue ?? "");
  const shortHost = dnsHostShort(host, customDomain);
  const isCert = normalized.purpose === "certificate";

  return (
    <li className="space-y-3 rounded-xl border border-default bg-surface p-4">
      <div>
        <p className="text-sm font-semibold text-primary">
          {isCert ? t("reseller.dnsPurposeCert") : t("reseller.dnsPurposeSubdomain")}
        </p>
        <p className="mt-1 text-sm text-secondary">
          {isCert ? t("reseller.dnsPurposeCertHelp") : t("reseller.dnsPurposeSubdomainHelp")}
        </p>
      </div>
      <DnsCopyField
        label={t("reseller.dnsType")}
        value={normalized.type || "CNAME"}
        copyLabel={t("reseller.dnsCopy")}
        copiedLabel={t("reseller.dnsCopied")}
      />
      <DnsCopyField
        label={t("reseller.dnsHost")}
        value={host}
        hint={
          shortHost !== host
            ? `${t("reseller.dnsHostHint")} → ${shortHost}`
            : t("reseller.dnsHostHint")
        }
        copyLabel={t("reseller.dnsCopy")}
        copiedLabel={t("reseller.dnsCopied")}
      />
      <DnsCopyField
        label={t("reseller.dnsValue")}
        value={value}
        copyLabel={t("reseller.dnsCopy")}
        copiedLabel={t("reseller.dnsCopied")}
      />
    </li>
  );
}

export default function SubaccountsPage() {
  const t = useT();
  const router = useRouter();
  const { confirm } = useDialog();

  useEffect(() => {
    setTenantContext(null);
  }, []);

  const { data: me } = useQuery({
    queryKey: ["tenants", "me", "home"],
    queryFn: () => api.get<Tenant>("/tenants/me"),
  });
  const isReseller = me?.plan === "reseller" || me?.tenantKind === "reseller";
  const subaccounts = useResellerSubaccounts(Boolean(isReseller));
  const createSubaccount = useCreateSubaccount();
  const deleteSubaccount = useDeleteSubaccount();
  const sendCredentials = useSendSubaccountCredentials();
  const updateSubaccount = useUpdateSubaccount();
  const assume = useAssumeSubaccount();
  const clearContext = useClearTenantContext();
  const domainQuery = useResellerDomain(Boolean(isReseller));
  const registerDomain = useRegisterResellerDomain();
  const deleteDomain = useDeleteResellerDomain();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [notifyOwner, setNotifyOwner] = useState(false);
  const [enabledServices, setEnabledServices] = useState<SubaccountServiceId[]>(
    defaultEnabledServices
  );
  const [serviceLimits, setServiceLimits] = useState<ResellerLimitsOverride>(
    emptyServiceLimits
  );
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [editServices, setEditServices] = useState<SubaccountServiceId[]>(
    defaultEnabledServices
  );
  const [editLimits, setEditLimits] = useState<ResellerLimitsOverride>({});
  const [domain, setDomain] = useState("");
  const [domainHydrated, setDomainHydrated] = useState(false);
  const [inviteInfo, setInviteInfo] = useState<string | null>(null);
  const [inviteInfoType, setInviteInfoType] = useState<"success" | "warning">("success");
  const [createError, setCreateError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [sendCredentialsError, setSendCredentialsError] = useState("");
  const [assumed, setAssumed] = useState<string | null>(null);
  const [pageTab, setPageTab] = useState<
    "accounts" | "create" | "bag" | "billing" | "domain" | "metaApp"
  >(
    "accounts"
  );

  useEffect(() => {
    setAssumed(getTenantContext());
  }, []);

  useEffect(() => {
    if (domainHydrated || !domainQuery.isSuccess) return;
    setDomain(domainQuery.data?.customDomain ?? "");
    setDomainHydrated(true);
  }, [domainHydrated, domainQuery.isSuccess, domainQuery.data?.customDomain]);

  const domainStatus = domainQuery.data?.customDomainStatus ?? "none";
  const statusLabel =
    domainStatus === "active"
      ? t("reseller.statusActive")
      : domainStatus === "pending_dns"
        ? t("reseller.statusPendingDns")
        : domainStatus === "error"
          ? t("reseller.statusError")
          : t("reseller.statusNone");

  const dnsRecords = [...(domainQuery.data?.dnsRecords ?? [])].sort((a, b) => {
    if (a.purpose === b.purpose) return 0;
    return a.purpose === "certificate" ? -1 : 1;
  });

  if (me && !isReseller) {
    return (
      <DashboardPage>
        <PageHeader title={t("reseller.title")} subtitle={t("common.planReseller")} />
        <p className="text-sm text-secondary">Reseller plan required</p>
      </DashboardPage>
    );
  }

  function subaccountErrorMessage(message: string): string {
    if (message === "A user with this email already exists") {
      return t("reseller.emailAlreadyExists");
    }
    if (message === "An account with this email already exists") {
      return t("reseller.accountEmailAlreadyExists");
    }
    if (message.startsWith("Maximum subaccounts reached")) {
      return message;
    }
    return message || t("reseller.createError");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    try {
      const shouldNotifyOwner = notifyOwner;
      const result = await createSubaccount.mutateAsync({
        name,
        email,
        ownerName: ownerName || undefined,
        inviteOwner: shouldNotifyOwner,
        enabledServices,
        serviceLimits,
      });
      setName("");
      setEmail("");
      setOwnerName("");
      setNotifyOwner(false);
      setEnabledServices(defaultEnabledServices());
      setServiceLimits(emptyServiceLimits());
      setPageTab("accounts");
      if (result.invite?.emailSent) {
        setInviteInfoType("success");
        setInviteInfo(t("reseller.inviteEmailSent", { email }));
      } else if (result.invite) {
        setInviteInfoType("warning");
        if (result.invite.temporaryPassword) {
          setInviteInfo(
            t("reseller.invitePasswordFallback", {
              email,
              password: result.invite.temporaryPassword,
            })
          );
        } else if (result.invite.emailFailureReason === "recipient_not_verified") {
          setInviteInfo(t("reseller.inviteEmailFailedSandbox", { email }));
        } else {
          setInviteInfo(t("reseller.inviteEmailFailed", { email }));
        }
      } else {
        setInviteInfoType("success");
        setInviteInfo(
          shouldNotifyOwner ? t("reseller.created") : t("reseller.createdWithoutInvite")
        );
      }
    } catch (err) {
      setCreateError(subaccountErrorMessage((err as Error).message));
    }
  }

  async function handleAssume(id: string) {
    await assume.mutateAsync(id);
    setAssumed(id);
    router.push(MEMBER_HOME);
  }

  async function handleSendCredentials(item: Tenant) {
    setSendCredentialsError("");
    try {
      const result = await sendCredentials.mutateAsync(item.tenantId);
      const email = item.email ?? "";
      if (result.invite.emailSent) {
        setInviteInfoType("success");
        setInviteInfo(t("reseller.sendCredentialsEmailSent", { email }));
      } else {
        setInviteInfoType("warning");
        if (result.invite.temporaryPassword) {
          setInviteInfo(
            t("reseller.sendCredentialsPasswordFallback", {
              email,
              password: result.invite.temporaryPassword,
            })
          );
        } else if (result.invite.emailFailureReason === "recipient_not_verified") {
          setInviteInfo(t("reseller.sendCredentialsEmailFailedSandbox", { email }));
        } else {
          setInviteInfo(t("reseller.sendCredentialsEmailFailed", { email }));
        }
      }
    } catch (err) {
      setSendCredentialsError(subaccountErrorMessage((err as Error).message));
    }
  }

  async function handleDelete(item: Tenant) {
    const confirmed = await confirm({
      title: t("reseller.confirmDeleteTitle"),
      description: t("reseller.confirmDeleteDescription", { name: item.name }),
      confirmLabel: t("common.delete"),
      tone: "danger",
    });
    if (!confirmed) return;

    setDeleteError("");
    try {
      await deleteSubaccount.mutateAsync(item.tenantId);
      if (assumed === item.tenantId) {
        clearContext();
        setAssumed(null);
      }
      setInviteInfoType("success");
      setInviteInfo(t("reseller.deleted"));
    } catch (err) {
      setDeleteError((err as Error).message || t("reseller.deleteError"));
    }
  }

  return (
    <DashboardPage className="space-y-8">
      <PageHeader title={t("reseller.title")} subtitle={t("reseller.subtitle")} />

      {assumed && (
        <div className="flex items-center justify-between rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm">
          <span>{t("reseller.assumedBanner")}</span>
          <button
            type="button"
            className="rounded-lg border border-default px-3 py-1"
            onClick={() => {
              clearContext();
              setAssumed(null);
              router.refresh();
            }}
          >
            {t("nav.exitSubaccount")}
          </button>
        </div>
      )}

      {inviteInfo ? (
        <p
          className={`rounded-xl border px-4 py-3 text-sm ${
            inviteInfoType === "success"
              ? "border-success/25 bg-success/10 text-success"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          {inviteInfo}
        </p>
      ) : null}

      {deleteError ? (
        <Alert variant="danger" onDismiss={() => setDeleteError("")}>
          {deleteError}
        </Alert>
      ) : null}

      {sendCredentialsError ? (
        <Alert variant="danger" onDismiss={() => setSendCredentialsError("")}>
          {sendCredentialsError}
        </Alert>
      ) : null}

      <Tabs
        className="w-full"
        items={[
          {
            id: "accounts",
            label: t("reseller.tabAccounts"),
            count: subaccounts.data?.count ?? 0,
          },
          { id: "create", label: t("reseller.tabCreate") },
          { id: "bag", label: t("reseller.tabBag") },
          { id: "billing", label: t("reseller.tabBilling") },
          { id: "domain", label: t("reseller.tabDomain") },
          { id: "metaApp", label: t("reseller.tabMetaApp") },
        ]}
        value={pageTab}
        onChange={setPageTab}
      />

      {pageTab === "accounts" ? (
        <p className="text-sm text-secondary">
          {t("reseller.usage", {
            count: String(subaccounts.data?.count ?? 0),
            max: String(subaccounts.data?.maxSubaccounts ?? 0),
          })}
        </p>
      ) : null}

      {pageTab === "bag" ? <ResellerBagPanel bag={subaccounts.data?.bag} /> : null}

      {pageTab === "billing" ? (
        <SubaccountBillingPanel
          items={subaccounts.data?.items}
          usagePeriod={subaccounts.data?.usagePeriod}
          usageTotals={subaccounts.data?.usageTotals}
          bagTotal={subaccounts.data?.bag?.total}
        />
      ) : null}

      {pageTab === "create" ? (
      <form
        onSubmit={(e) => void handleCreate(e)}
        className="content-card space-y-5 p-5 sm:p-6"
      >
        <div>
          <h2 className="text-base font-semibold text-primary">{t("reseller.create")}</h2>
          <p className="mt-1 text-sm text-secondary">{t("reseller.servicesHint")}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("reseller.name")}
            className="rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary"
          />
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("reseller.ownerEmail")}
            className="rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary"
          />
          <input
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            placeholder={t("reseller.ownerName")}
            className="rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary"
          />
        </div>
        <label className="flex items-start gap-3 rounded-xl border border-default bg-surface px-4 py-3">
          <input
            type="checkbox"
            checked={notifyOwner}
            onChange={(e) => setNotifyOwner(e.target.checked)}
            className="mt-0.5 rounded border-default"
          />
          <span className="space-y-1">
            <span className="block text-sm font-medium text-primary">{t("reseller.notifyOwner")}</span>
            <span className="block text-sm text-secondary">{t("reseller.notifyOwnerHint")}</span>
          </span>
        </label>
        <div className="rounded-xl border border-default bg-surface p-4">
          <SubaccountServicesFields
            enabledServices={enabledServices}
            serviceLimits={serviceLimits}
            bag={subaccounts.data?.bag}
            onChange={(next) => {
              setEnabledServices(next.enabledServices);
              setServiceLimits(next.serviceLimits);
            }}
          />
        </div>
        {createError ? (
          <Alert variant="danger" onDismiss={() => setCreateError("")}>
            {createError}
          </Alert>
        ) : null}
        <div className="flex justify-end">
          <Button type="submit" disabled={createSubaccount.isPending}>
            {t("reseller.create")}
          </Button>
        </div>
      </form>
      ) : null}

      {pageTab === "accounts" ? (
      subaccounts.isLoading ? (
        <div className="h-32 animate-pulse rounded-xl bg-surface-muted" />
      ) : !subaccounts.data?.items.length ? (
        <p className="text-sm text-secondary">{t("reseller.empty")}</p>
      ) : (
        <TableContainer className="rounded-xl border border-default bg-surface-elevated">
          <table className="min-w-full text-sm">
            <thead className="bg-surface text-left text-secondary">
              <tr>
                <th className="px-4 py-3 font-medium">{t("reseller.name")}</th>
                <th className="px-4 py-3 font-medium">{t("common.email")}</th>
                <th className="px-4 py-3 font-medium">{t("admin.users.plan")}</th>
                <th className="px-4 py-3 font-medium">{t("reseller.services")}</th>
                <th className="px-4 py-3 font-medium">{t("reseller.whatsappRiskTitle")}</th>
                <th className="px-4 py-3 font-medium">{t("common.status")}</th>
                <th className="px-4 py-3 font-medium text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {subaccounts.data.items.map((item) => (
                <tr key={item.tenantId}>
                  <td className="px-4 py-3 text-primary">{item.name}</td>
                  <td className="px-4 py-3 text-secondary">{item.email}</td>
                  <td className="px-4 py-3 text-secondary">{item.plan}</td>
                  <td className="px-4 py-3">
                    <SubaccountServiceChips services={item.enabledServices} t={t} />
                  </td>
                  <td className="px-4 py-3">
                    <WhatsAppRiskBadge risk={item.whatsappRisk} compact />
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={item.status === "active" ? "success" : "default"}>
                      {item.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <SubaccountActionsMenu
                      item={item}
                      busy={
                        updateSubaccount.isPending ||
                        deleteSubaccount.isPending ||
                        sendCredentials.isPending
                      }
                      onAssume={() => void handleAssume(item.tenantId)}
                      onEditServices={() => {
                        setEditing(item);
                        setEditServices(
                          item.enabledServices?.length
                            ? item.enabledServices
                            : defaultEnabledServices()
                        );
                        setEditLimits(item.serviceLimits ?? {});
                      }}
                      onSendCredentials={() => void handleSendCredentials(item)}
                      onToggleStatus={() =>
                        void updateSubaccount.mutateAsync({
                          subaccountId: item.tenantId,
                          status: item.status === "suspended" ? "active" : "suspended",
                        })
                      }
                      onDelete={() => void handleDelete(item)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableContainer>
      )
      ) : null}

      {pageTab === "domain" ? (
      <section className="content-card space-y-4 p-5 sm:p-6">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-primary">{t("reseller.domainTitle")}</h2>
          <p className="text-sm text-secondary">{t("reseller.domainHint")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder={t("reseller.domainPlaceholder")}
            className="min-w-[16rem] flex-1 rounded-lg border border-default px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={registerDomain.isPending || !domain.trim()}
            onClick={() => void registerDomain.mutateAsync(domain.trim())}
            className="rounded-lg bg-accent px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {t("reseller.saveDomain")}
          </button>
          {domainQuery.data?.customDomain ? (
            <button
              type="button"
              disabled={deleteDomain.isPending}
              onClick={() =>
                void deleteDomain.mutateAsync().then(() => setDomain(""))
              }
              className="rounded-lg border border-default px-4 py-2 text-sm text-secondary disabled:opacity-50"
            >
              {t("reseller.removeDomain")}
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-secondary">{t("reseller.domainStatus")}:</span>
          <Badge
            variant={
              domainStatus === "active"
                ? "success"
                : domainStatus === "error"
                  ? "danger"
                  : domainStatus === "pending_dns"
                    ? "warning"
                    : "default"
            }
          >
            {statusLabel}
          </Badge>
          {domainQuery.data?.customDomain ? (
            <a
              href={portalUrl(domainQuery.data.customDomain)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-accent hover:underline"
            >
              {portalUrl(domainQuery.data.customDomain)}
              <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="sr-only">{t("reseller.openDomain")}</span>
            </a>
          ) : null}
        </div>
        {domainQuery.data?.amplifyStatusReason && (
          <p className="text-sm text-red-600">{domainQuery.data.amplifyStatusReason}</p>
        )}

        {dnsRecords.length > 0 && (
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-primary">{t("reseller.dnsRecords")}</p>
              <p className="text-sm text-secondary">{t("reseller.dnsRecordsIntro")}</p>
            </div>
            <ul className="space-y-3">
              {dnsRecords.map((record) => (
                <DnsRecordCard
                  key={`${record.purpose}-${record.name}-${record.value}`}
                  record={record}
                  customDomain={domainQuery.data?.customDomain}
                  fallbackValue={
                    record.purpose === "subdomain"
                      ? domainQuery.data?.cnameTarget
                      : undefined
                  }
                  t={t}
                />
              ))}
            </ul>
            <p className="text-sm text-secondary">{t("reseller.dnsWaitHint")}</p>
          </div>
        )}
      </section>
      ) : null}

      {pageTab === "metaApp" ? <ResellerMetaAppPanel /> : null}

      {editing ? (
        <Modal>
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-surface-elevated shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-default px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-primary">
                  {t("reseller.servicesTitle")}
                </h2>
                <p className="mt-0.5 text-sm text-secondary">{editing.name}</p>
              </div>
              <Badge variant="accent" dot>
                {t("reseller.enabledOf", {
                  count: String(editServices.length),
                  total: String(defaultEnabledServices().length),
                })}
              </Badge>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <SubaccountServicesFields
                showHeader={false}
                enabledServices={editServices}
                serviceLimits={editLimits}
                bag={subaccounts.data?.bag}
                currentLimits={editing.serviceLimits}
                onChange={(next) => {
                  setEditServices(next.enabledServices);
                  setEditLimits(next.serviceLimits);
                }}
              />
            </div>
            {updateSubaccount.isError ? (
              <p className="border-t border-default px-5 py-2 text-sm text-red-600">
                {updateSubaccount.error instanceof Error
                  ? updateSubaccount.error.message
                  : t("reseller.bagTitle")}
              </p>
            ) : null}
            <div className="flex justify-end gap-2 border-t border-default px-5 py-3">
              <Button variant="outline" onClick={() => setEditing(null)}>
                {t("common.cancel")}
              </Button>
              <Button
                disabled={updateSubaccount.isPending}
                onClick={() =>
                  void updateSubaccount
                    .mutateAsync({
                      subaccountId: editing.tenantId,
                      enabledServices: editServices,
                      serviceLimits: editLimits,
                    })
                    .then(() => setEditing(null))
                }
              >
                {t("reseller.saveServices")}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </DashboardPage>
  );
}
