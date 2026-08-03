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
  useResellerSubaccounts,
  useUpdateSubaccount,
  type ResellerDomainDnsRecord,
} from "@/hooks/useReseller";
import type { Tenant } from "@/types";
import { useRouter } from "next/navigation";

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
  const updateSubaccount = useUpdateSubaccount();
  const assume = useAssumeSubaccount();
  const clearContext = useClearTenantContext();
  const domainQuery = useResellerDomain(Boolean(isReseller));
  const registerDomain = useRegisterResellerDomain();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [domain, setDomain] = useState("");
  const [inviteInfo, setInviteInfo] = useState<string | null>(null);
  const [assumed, setAssumed] = useState<string | null>(null);

  useEffect(() => {
    setAssumed(getTenantContext());
  }, []);

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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const result = await createSubaccount.mutateAsync({
      name,
      email,
      ownerName: ownerName || undefined,
    });
    setName("");
    setEmail("");
    setOwnerName("");
    if (result.invite?.temporaryPassword) {
      setInviteInfo(
        `${t("reseller.invitePassword")}: ${result.invite.temporaryPassword}`
      );
    } else {
      setInviteInfo(t("reseller.created"));
    }
  }

  async function handleAssume(id: string) {
    await assume.mutateAsync(id);
    setAssumed(id);
    router.push("/bots");
  }

  return (
    <DashboardPage maxWidth="5xl" className="space-y-8">
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

      <p className="text-sm text-secondary">
        {t("reseller.usage", {
          count: String(subaccounts.data?.count ?? 0),
          max: String(subaccounts.data?.maxSubaccounts ?? 0),
        })}
      </p>

      <form
        onSubmit={(e) => void handleCreate(e)}
        className="grid gap-3 rounded-xl border border-default bg-surface-elevated p-4 sm:grid-cols-2"
      >
        <h2 className="sm:col-span-2 text-base font-semibold text-primary">
          {t("reseller.create")}
        </h2>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("reseller.name")}
          className="rounded-lg border border-default px-3 py-2 text-sm"
        />
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("reseller.ownerEmail")}
          className="rounded-lg border border-default px-3 py-2 text-sm"
        />
        <input
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
          placeholder={t("reseller.ownerName")}
          className="rounded-lg border border-default px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={createSubaccount.isPending}
          className="rounded-lg bg-accent px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {t("reseller.create")}
        </button>
        {inviteInfo && (
          <p className="sm:col-span-2 text-sm text-green-600">{inviteInfo}</p>
        )}
      </form>

      {subaccounts.isLoading ? (
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
                <th className="px-4 py-3 font-medium">{t("common.status")}</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {subaccounts.data.items.map((item) => (
                <tr key={item.tenantId}>
                  <td className="px-4 py-3 text-primary">{item.name}</td>
                  <td className="px-4 py-3 text-secondary">{item.email}</td>
                  <td className="px-4 py-3 text-secondary">{item.plan}</td>
                  <td className="px-4 py-3">
                    <Badge variant={item.status === "active" ? "success" : "default"}>
                      {item.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded border border-default px-2 py-1 text-xs"
                        onClick={() => void handleAssume(item.tenantId)}
                      >
                        {t("reseller.assume")}
                      </button>
                      <button
                        type="button"
                        className="rounded border border-default px-2 py-1 text-xs"
                        disabled={updateSubaccount.isPending}
                        onClick={() =>
                          void updateSubaccount.mutateAsync({
                            subaccountId: item.tenantId,
                            status:
                              item.status === "suspended" ? "active" : "suspended",
                          })
                        }
                      >
                        {item.status === "suspended"
                          ? t("reseller.activate")
                          : t("reseller.suspend")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableContainer>
      )}

      <section className="space-y-4 rounded-xl border border-default bg-surface-elevated p-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-primary">{t("reseller.domainTitle")}</h2>
          <p className="text-sm text-secondary">{t("reseller.domainHint")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            value={domain || domainQuery.data?.customDomain || ""}
            onChange={(e) => setDomain(e.target.value)}
            placeholder={t("reseller.domainPlaceholder")}
            className="min-w-[16rem] flex-1 rounded-lg border border-default px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={
              registerDomain.isPending || !(domain || domainQuery.data?.customDomain)
            }
            onClick={() =>
              void registerDomain.mutateAsync(
                domain || domainQuery.data?.customDomain || ""
              )
            }
            className="rounded-lg bg-accent px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {t("reseller.saveDomain")}
          </button>
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
          {domainQuery.data?.amplifyStatus ? (
            <span className="text-secondary">
              · {t("reseller.amplifyStatus")}: {domainQuery.data.amplifyStatus}
            </span>
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
    </DashboardPage>
  );
}
