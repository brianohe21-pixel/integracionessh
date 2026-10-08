"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Calculator, Copy, Download, Check } from "lucide-react";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { useAdminBillingConfig } from "@/hooks/useAdminBilling";
import { useBillingProviders } from "@/hooks/useBilling";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";
import {
  DEFAULT_QUOTE_VALIDITY_DAYS,
  DEFAULT_TRM_COP,
  WHATSAPP_MESSAGE_CATEGORIES,
  calculateProQuote,
  calculateResellerQuote,
  defaultProQuoteInput,
  defaultResellerQuoteInput,
  formatCopAmount,
  formatUsdAmount,
  type ProQuoteInput,
  type QuotePlanKind,
  type ResellerQuoteInput,
  type WhatsappMessageCategory,
} from "@/lib/price-calculator";
import { downloadPriceQuotePdf } from "@/lib/price-quote-pdf";

type Tab = QuotePlanKind;

function parseNumberInput(value: string): number {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return 0;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function pesosInputFromCents(cents: number): string {
  if (!cents) return "0";
  return String(cents / 100);
}

function centsFromPesosInput(value: string): number {
  const pesos = parseNumberInput(value);
  return Math.round(Math.max(0, pesos) * 100);
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-secondary">{label}</span>
      {children}
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-default bg-surface px-3 py-2 text-primary";

function categoryLabelKey(category: WhatsappMessageCategory): string {
  return `admin.priceCalculator.whatsappCategory.${category}`;
}

export default function AdminPriceCalculatorPage() {
  const t = useT();
  const configQuery = useAdminBillingConfig();
  const providersQuery = useBillingProviders();
  const [tab, setTab] = useState<Tab>("pro");
  const [clientName, setClientName] = useState("");
  const [validityDays, setValidityDays] = useState(String(DEFAULT_QUOTE_VALIDITY_DAYS));
  const [notes, setNotes] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [defaultsReady, setDefaultsReady] = useState(false);
  const [whatsappCategory, setWhatsappCategory] =
    useState<WhatsappMessageCategory>("utility");

  const [proForm, setProForm] = useState<ProQuoteInput>(() => defaultProQuoteInput());
  const [resellerForm, setResellerForm] = useState<ResellerQuoteInput>(() =>
    defaultResellerQuoteInput()
  );
  const [pricePerMsgInput, setPricePerMsgInput] = useState("0");
  const [whatsappFeeInput, setWhatsappFeeInput] = useState("0");

  useEffect(() => {
    if (defaultsReady) return;
    if (configQuery.isLoading || providersQuery.isLoading) return;

    const trm = providersQuery.data?.plans?.starter?.trm ?? DEFAULT_TRM_COP;
    const pricePerMessageCents = configQuery.data?.pricePerMessageCents ?? 0;

    setProForm((prev) => ({
      ...prev,
      trm,
      pricePerMessageCents,
    }));
    setResellerForm((prev) => ({
      ...prev,
      trm,
      pricePerMessageCents,
    }));
    setPricePerMsgInput(pesosInputFromCents(pricePerMessageCents));
    setWhatsappFeeInput(
      pesosInputFromCents(defaultProQuoteInput().whatsappCategoryFeesCents.utility)
    );
    setDefaultsReady(true);
  }, [
    configQuery.data?.pricePerMessageCents,
    configQuery.isLoading,
    defaultsReady,
    providersQuery.data?.plans?.starter?.trm,
    providersQuery.isLoading,
  ]);

  const proResult = useMemo(() => calculateProQuote(proForm), [proForm]);
  const resellerResult = useMemo(
    () => calculateResellerQuote(resellerForm),
    [resellerForm]
  );

  const activeResult = tab === "pro" ? proResult : resellerResult;
  const activeTrm = tab === "pro" ? proForm.trm : resellerForm.trm;
  const activeFees =
    tab === "pro" ? proForm.whatsappCategoryFeesCents : resellerForm.whatsappCategoryFeesCents;
  const activeMessages =
    tab === "pro"
      ? proForm.whatsappCategoryMessages
      : resellerForm.whatsappCategoryMessages;

  useEffect(() => {
    setWhatsappFeeInput(pesosInputFromCents(activeFees[whatsappCategory]));
  }, [activeFees, whatsappCategory]);

  function updatePricePerMessage(value: string) {
    setPricePerMsgInput(value);
    const cents = centsFromPesosInput(value);
    setProForm((prev) => ({ ...prev, pricePerMessageCents: cents }));
    setResellerForm((prev) => ({ ...prev, pricePerMessageCents: cents }));
  }

  function updateWhatsappCategoryFee(value: string) {
    setWhatsappFeeInput(value);
    const cents = centsFromPesosInput(value);
    setProForm((prev) => ({
      ...prev,
      whatsappCategoryFeesCents: {
        ...prev.whatsappCategoryFeesCents,
        [whatsappCategory]: cents,
      },
    }));
    setResellerForm((prev) => ({
      ...prev,
      whatsappCategoryFeesCents: {
        ...prev.whatsappCategoryFeesCents,
        [whatsappCategory]: cents,
      },
    }));
  }

  function updateWhatsappCategoryMessages(value: string) {
    const messages = Math.floor(parseNumberInput(value));
    if (tab === "pro") {
      setProForm((prev) => ({
        ...prev,
        whatsappCategoryMessages: {
          ...prev.whatsappCategoryMessages,
          [whatsappCategory]: messages,
        },
      }));
    } else {
      setResellerForm((prev) => ({
        ...prev,
        whatsappCategoryMessages: {
          ...prev.whatsappCategoryMessages,
          [whatsappCategory]: messages,
        },
      }));
    }
  }

  function whatsappMetaLines() {
    return activeResult.whatsappBreakdown
      .filter((row) => row.messages > 0 || row.feePerMessageCents > 0)
      .map((row) => {
        const fee = formatCopAmount(row.feePerMessageCents / 100);
        const detail =
          row.messages === 0
            ? t("admin.priceCalculator.whatsappCategoryFeeFixed", { fee })
            : `${row.messages.toLocaleString()} × ${fee} = ${formatCopAmount(row.amountCop)}`;
        return `${t(categoryLabelKey(row.category))}: ${detail}`;
      });
  }

  function buildSummaryText(): string {
    const planLabel = tab === "pro" ? "Pro" : "Reseller";
    const lines = [
      `${t("admin.priceCalculator.quoteTitle")} — ${planLabel}`,
      clientName.trim()
        ? `${t("admin.priceCalculator.clientName")}: ${clientName.trim()}`
        : null,
      `${t("admin.priceCalculator.trm")}: ${activeTrm.toLocaleString("es-CO")}`,
    ].filter(Boolean) as string[];

    if (tab === "pro") {
      lines.push(
        `${t("admin.priceCalculator.lineBaseFee")}: ${formatCopAmount(proResult.baseFeeCop)} (${formatUsdAmount(proResult.baseFeeUsd)})`,
        `${t("admin.priceCalculator.lineDiscount")}: ${formatCopAmount(proResult.discountCop)}`,
        `${t("admin.priceCalculator.lineOverage")}: ${formatCopAmount(proResult.overageCop)} (${proResult.overageMessages.toLocaleString()} msgs)`,
        `${t("admin.priceCalculator.lineWhatsappFee")}: ${formatCopAmount(proResult.whatsappFeeCop)} (${proResult.whatsappMessages.toLocaleString()} msgs)`,
        ...whatsappMetaLines(),
        `${t("admin.priceCalculator.totalMonthly")}: ${formatCopAmount(proResult.totalCop)} / ${formatUsdAmount(proResult.totalUsd)}`
      );
    } else {
      lines.push(
        `${t("admin.priceCalculator.lineBaseFee")}: ${formatCopAmount(resellerResult.baseFeeCop)} (${formatUsdAmount(resellerResult.baseFeeUsd)})`,
        `${t("admin.priceCalculator.lineOverage")}: ${formatCopAmount(resellerResult.overageCop)} (${resellerResult.overageMessages.toLocaleString()} msgs)`,
        `${t("admin.priceCalculator.lineWhatsappFee")}: ${formatCopAmount(resellerResult.whatsappFeeCop)} (${resellerResult.whatsappMessages.toLocaleString()} msgs)`,
        ...whatsappMetaLines(),
        `${t("admin.priceCalculator.linePlatformCost")}: ${formatCopAmount(resellerResult.platformCostCop)}`,
        `${t("admin.priceCalculator.lineSuggestedPrice")}: ${formatCopAmount(resellerResult.suggestedPriceCop)} / ${formatUsdAmount(resellerResult.suggestedPriceUsd)}`,
        `${t("admin.priceCalculator.costPerSubaccount")}: ${formatCopAmount(resellerResult.costPerSubaccountCop)}`
      );
    }

    if (notes.trim()) {
      lines.push(`${t("admin.priceCalculator.notes")}: ${notes.trim()}`);
    }

    return lines.join("\n");
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(buildSummaryText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function handleDownloadPdf() {
    setDownloading(true);
    try {
      const validity = Math.max(1, Math.floor(parseNumberInput(validityDays)) || DEFAULT_QUOTE_VALIDITY_DAYS);
      const metaLines =
        tab === "pro"
          ? [
              `${t("admin.priceCalculator.includedMessages")}: ${proForm.includedMessages.toLocaleString()}`,
              `${t("admin.priceCalculator.aiResponsesPerMonth")}: ${proForm.expectedMessages.toLocaleString()}`,
              `${t("admin.priceCalculator.pricePerMessage")}: ${formatCopAmount(proForm.pricePerMessageCents / 100)}`,
              `${t("admin.priceCalculator.whatsappMessages")}: ${proResult.whatsappMessages.toLocaleString()}`,
              ...whatsappMetaLines(),
              `${t("admin.priceCalculator.discountPercent")}: ${proForm.discountPercent}%`,
              `${t("admin.priceCalculator.trm")}: ${proForm.trm.toLocaleString("es-CO")}`,
            ]
          : [
              `${t("admin.priceCalculator.subaccounts")}: ${resellerForm.subaccounts.toLocaleString()}`,
              `${t("admin.priceCalculator.messageBag")}: ${resellerForm.messageBag.toLocaleString()}`,
              `${t("admin.priceCalculator.aiResponsesPerMonth")}: ${resellerForm.expectedMessages.toLocaleString()}`,
              `${t("admin.priceCalculator.pricePerMessage")}: ${formatCopAmount(resellerForm.pricePerMessageCents / 100)}`,
              `${t("admin.priceCalculator.whatsappMessages")}: ${resellerResult.whatsappMessages.toLocaleString()}`,
              ...whatsappMetaLines(),
              `${t("admin.priceCalculator.marginPercent")}: ${resellerForm.marginPercent}%`,
              `${t("admin.priceCalculator.trm")}: ${resellerForm.trm.toLocaleString("es-CO")}`,
            ];

      await downloadPriceQuotePdf({
        kind: tab,
        clientName: clientName.trim() || undefined,
        issuedAt: new Date(),
        validityDays: validity,
        notes: notes.trim() || undefined,
        result: activeResult,
        metaLines,
        labels: {
          title: t("admin.priceCalculator.quoteTitle"),
          brandName: t("admin.priceCalculator.brandName"),
          planLabel: t("admin.priceCalculator.plan"),
          clientLabel: t("admin.priceCalculator.clientName"),
          issuedLabel: t("admin.priceCalculator.issuedAt"),
          validUntilLabel: t("admin.priceCalculator.validUntil"),
          conceptLabel: t("admin.priceCalculator.concept"),
          amountCopLabel: t("admin.priceCalculator.amountCop"),
          amountUsdLabel: t("admin.priceCalculator.amountUsd"),
          notesLabel: t("admin.priceCalculator.notes"),
          totalLabel: t("admin.priceCalculator.totalMonthly"),
          footerNote: t("admin.priceCalculator.pdfFooter"),
          filenamePrefix: t("admin.priceCalculator.pdfFilename"),
          lineLabels: {
            baseFee: t("admin.priceCalculator.lineBaseFee"),
            discount: t("admin.priceCalculator.lineDiscount"),
            overage: t("admin.priceCalculator.lineOverage"),
            whatsappFee: t("admin.priceCalculator.lineWhatsappFee"),
            platformCost: t("admin.priceCalculator.linePlatformCost"),
            margin: t("admin.priceCalculator.lineMargin"),
            suggestedPrice: t("admin.priceCalculator.lineSuggestedPrice"),
          },
        },
      });
    } finally {
      setDownloading(false);
    }
  }

  const totalCop =
    activeResult.kind === "pro" ? activeResult.totalCop : activeResult.suggestedPriceCop;
  const totalUsd =
    activeResult.kind === "pro" ? activeResult.totalUsd : activeResult.suggestedPriceUsd;

  function lineLabel(key: string): string {
    const keys: Record<string, string> = {
      baseFee: "admin.priceCalculator.lineBaseFee",
      discount: "admin.priceCalculator.lineDiscount",
      overage: "admin.priceCalculator.lineOverage",
      whatsappFee: "admin.priceCalculator.lineWhatsappFee",
      platformCost: "admin.priceCalculator.linePlatformCost",
      margin: "admin.priceCalculator.lineMargin",
      suggestedPrice: "admin.priceCalculator.lineSuggestedPrice",
    };
    return t(keys[key] ?? key);
  }

  return (
    <DashboardPage className="space-y-8 pb-8">
      <PageHeader
        title={t("admin.priceCalculator.title")}
        subtitle={t("admin.priceCalculator.subtitle")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => void handleCopy()}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied
                ? t("admin.priceCalculator.copied")
                : t("admin.priceCalculator.copySummary")}
            </Button>
            <Button
              type="button"
              onClick={() => void handleDownloadPdf()}
              disabled={downloading}
            >
              <Download className="h-4 w-4" />
              {downloading
                ? t("admin.priceCalculator.pdfGenerating")
                : t("admin.priceCalculator.downloadPdf")}
            </Button>
          </div>
        }
      />

      <div className="flex gap-2">
        {(["pro", "reseller"] as Tab[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              tab === id
                ? "bg-accent text-white"
                : "bg-surface-muted text-secondary hover:text-primary"
            )}
          >
            {id === "pro"
              ? t("admin.priceCalculator.tabPro")
              : t("admin.priceCalculator.tabReseller")}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-6 rounded-xl border border-default bg-surface-elevated p-6">
          <div>
            <h2 className="text-lg font-semibold text-primary">
              {t("admin.priceCalculator.quoteHeader")}
            </h2>
            <p className="text-sm text-secondary">{t("admin.priceCalculator.quoteHeaderHint")}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("admin.priceCalculator.clientName")}>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className={inputClass}
                placeholder={t("admin.priceCalculator.clientNamePlaceholder")}
              />
            </Field>
            <Field label={t("admin.priceCalculator.validityDays")}>
              <input
                type="number"
                min={1}
                value={validityDays}
                onChange={(e) => setValidityDays(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label={t("admin.priceCalculator.trm")} hint={t("admin.priceCalculator.trmHint")}>
              <input
                type="number"
                min={0}
                step={1}
                value={activeTrm}
                onChange={(e) => {
                  const trm = parseNumberInput(e.target.value);
                  if (tab === "pro") {
                    setProForm((prev) => ({ ...prev, trm }));
                  } else {
                    setResellerForm((prev) => ({ ...prev, trm }));
                  }
                }}
                className={inputClass}
              />
            </Field>
            <Field label={t("admin.priceCalculator.pricePerMessage")}>
              <div className="flex items-center gap-2">
                <span className="font-medium text-primary">$</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={pricePerMsgInput}
                  onChange={(e) => updatePricePerMessage(e.target.value)}
                  className={inputClass}
                />
                <span className="whitespace-nowrap text-secondary">COP</span>
              </div>
            </Field>
            <Field
              label={t("admin.priceCalculator.aiResponsesPerMonth")}
              hint={t("admin.priceCalculator.aiResponsesHint")}
            >
              <input
                type="number"
                min={0}
                step={1}
                value={tab === "pro" ? proForm.expectedMessages : resellerForm.expectedMessages}
                onChange={(e) => {
                  const expectedMessages = parseNumberInput(e.target.value);
                  if (tab === "pro") {
                    setProForm((prev) => ({ ...prev, expectedMessages }));
                  } else {
                    setResellerForm((prev) => ({ ...prev, expectedMessages }));
                  }
                }}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="space-y-4 rounded-lg border border-default bg-surface p-4">
            <div>
              <h3 className="text-sm font-semibold text-primary">
                {t("admin.priceCalculator.whatsappSectionTitle")}
              </h3>
              <p className="text-xs text-muted">{t("admin.priceCalculator.whatsappFeeHint")}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t("admin.priceCalculator.whatsappCategoryLabel")}>
                <select
                  value={whatsappCategory}
                  onChange={(e) =>
                    setWhatsappCategory(e.target.value as WhatsappMessageCategory)
                  }
                  className={inputClass}
                >
                  {WHATSAPP_MESSAGE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {t(categoryLabelKey(category))}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("admin.priceCalculator.whatsappFeePerMessage")}>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-primary">$</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={whatsappFeeInput}
                    onChange={(e) => updateWhatsappCategoryFee(e.target.value)}
                    className={inputClass}
                  />
                  <span className="whitespace-nowrap text-secondary">COP</span>
                </div>
              </Field>
              <Field label={t("admin.priceCalculator.whatsappMessages")}>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={activeMessages[whatsappCategory]}
                  onChange={(e) => updateWhatsappCategoryMessages(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {activeResult.whatsappBreakdown.map((row) => (
                <button
                  key={row.category}
                  type="button"
                  onClick={() => setWhatsappCategory(row.category)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                    whatsappCategory === row.category
                      ? "border-accent bg-accent/5"
                      : "border-default hover:bg-surface-muted"
                  )}
                >
                  <div className="font-medium text-primary">
                    {t(categoryLabelKey(row.category))}
                  </div>
                  <div className="mt-0.5 text-muted">
                    {row.messages === 0
                      ? t("admin.priceCalculator.whatsappCategoryFeeFixed", {
                          fee: formatCopAmount(row.feePerMessageCents / 100),
                        })
                      : `${row.messages.toLocaleString()} × ${formatCopAmount(row.feePerMessageCents / 100)}`}
                  </div>
                  <div className="font-medium text-secondary">
                    {formatCopAmount(row.amountCop)}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {tab === "pro" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("admin.priceCalculator.baseFeeUsd")}>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={proForm.baseFeeUsd}
                  onChange={(e) =>
                    setProForm((prev) => ({
                      ...prev,
                      baseFeeUsd: parseNumberInput(e.target.value),
                    }))
                  }
                  className={inputClass}
                />
              </Field>
              <Field label={t("admin.priceCalculator.discountPercent")}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={proForm.discountPercent}
                  onChange={(e) =>
                    setProForm((prev) => ({
                      ...prev,
                      discountPercent: parseNumberInput(e.target.value),
                    }))
                  }
                  className={inputClass}
                />
              </Field>
              <Field label={t("admin.priceCalculator.includedMessages")}>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={proForm.includedMessages}
                  onChange={(e) =>
                    setProForm((prev) => ({
                      ...prev,
                      includedMessages: parseNumberInput(e.target.value),
                    }))
                  }
                  className={inputClass}
                />
              </Field>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("admin.priceCalculator.baseFeeUsd")}>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={resellerForm.baseFeeUsd}
                  onChange={(e) =>
                    setResellerForm((prev) => ({
                      ...prev,
                      baseFeeUsd: parseNumberInput(e.target.value),
                    }))
                  }
                  className={inputClass}
                />
              </Field>
              <Field label={t("admin.priceCalculator.marginPercent")}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={resellerForm.marginPercent}
                  onChange={(e) =>
                    setResellerForm((prev) => ({
                      ...prev,
                      marginPercent: parseNumberInput(e.target.value),
                    }))
                  }
                  className={inputClass}
                />
              </Field>
              <Field label={t("admin.priceCalculator.subaccounts")}>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={resellerForm.subaccounts}
                  onChange={(e) =>
                    setResellerForm((prev) => ({
                      ...prev,
                      subaccounts: parseNumberInput(e.target.value),
                    }))
                  }
                  className={inputClass}
                />
              </Field>
              <Field label={t("admin.priceCalculator.messageBag")}>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={resellerForm.messageBag}
                  onChange={(e) =>
                    setResellerForm((prev) => ({
                      ...prev,
                      messageBag: parseNumberInput(e.target.value),
                    }))
                  }
                  className={inputClass}
                />
              </Field>
            </div>
          )}

          <Field label={t("admin.priceCalculator.notes")}>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className={inputClass}
              placeholder={t("admin.priceCalculator.notesPlaceholder")}
            />
          </Field>
        </section>

        <section className="rounded-xl border border-default bg-surface-elevated p-6">
          <div className="mb-4 flex items-center gap-2">
            <Calculator className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-semibold text-primary">
              {t("admin.priceCalculator.previewTitle")}
            </h2>
          </div>

          <div className="rounded-lg border border-default bg-surface px-4 py-4">
            <p className="text-sm text-secondary">{t("admin.priceCalculator.totalMonthly")}</p>
            <p className="mt-1 text-2xl font-bold text-primary">{formatCopAmount(totalCop)}</p>
            <p className="mt-0.5 text-sm text-secondary">{formatUsdAmount(totalUsd)}</p>
          </div>

          <dl className="mt-5 space-y-3 text-sm">
            {activeResult.lines
              .filter((line) => line.key !== "total")
              .map((line) => (
                <div key={line.key} className="flex items-start justify-between gap-3">
                  <dt className="text-secondary">{lineLabel(line.key)}</dt>
                  <dd className="text-right font-medium text-primary tabular-nums">
                    <div>{formatCopAmount(line.amountCop)}</div>
                    <div className="text-xs font-normal text-muted">
                      {formatUsdAmount(line.amountUsd)}
                    </div>
                  </dd>
                </div>
              ))}
          </dl>

          <div className="mt-5 space-y-3 border-t border-default pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              {t("admin.priceCalculator.aiBreakdownTitle")}
            </p>
            <div className="rounded-lg border border-default bg-surface px-3 py-2.5 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-secondary">{t("admin.priceCalculator.aiExpectedLabel")}</span>
                <span className="font-medium tabular-nums text-primary">
                  {(tab === "pro"
                    ? proForm.expectedMessages
                    : resellerForm.expectedMessages
                  ).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-secondary">{t("admin.priceCalculator.aiIncludedLabel")}</span>
                <span className="font-medium tabular-nums text-primary">
                  {(tab === "pro"
                    ? proForm.includedMessages
                    : resellerForm.messageBag
                  ).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-secondary">{t("admin.priceCalculator.aiUnitPriceLabel")}</span>
                <span className="font-medium tabular-nums text-primary">
                  {formatCopAmount(
                    (tab === "pro"
                      ? proForm.pricePerMessageCents
                      : resellerForm.pricePerMessageCents) / 100
                  )}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3 border-t border-default pt-2">
                <div>
                  <p className="text-secondary">{t("admin.priceCalculator.aiOverageAmountLabel")}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {t("admin.priceCalculator.aiOverageLine", {
                      count: activeResult.overageMessages.toLocaleString(),
                      fee: formatCopAmount(
                        (tab === "pro"
                          ? proForm.pricePerMessageCents
                          : resellerForm.pricePerMessageCents) / 100
                      ),
                    })}
                  </p>
                </div>
                <div className="text-right tabular-nums">
                  <p className="font-medium text-primary">
                    {formatCopAmount(activeResult.overageCop)}
                  </p>
                  <p className="text-xs text-muted">{formatUsdAmount(activeResult.overageUsd)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-3 border-t border-default pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              {t("admin.priceCalculator.whatsappBreakdownTitle")}
            </p>
            {activeResult.whatsappBreakdown.map((row) => (
              <div
                key={row.category}
                className={cn(
                  "rounded-lg border px-3 py-2.5",
                  row.amountCop > 0 || row.messages > 0
                    ? "border-default bg-surface"
                    : "border-transparent bg-surface-muted/40"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-primary">
                      {t(categoryLabelKey(row.category))}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {row.messages === 0
                        ? t("admin.priceCalculator.whatsappCategoryFeeFixed", {
                            fee: formatCopAmount(row.feePerMessageCents / 100),
                          })
                        : t("admin.priceCalculator.whatsappCategoryFeeLine", {
                            fee: formatCopAmount(row.feePerMessageCents / 100),
                            count: row.messages.toLocaleString(),
                          })}
                    </p>
                  </div>
                  <div className="text-right tabular-nums">
                    <p className="text-sm font-medium text-primary">
                      {formatCopAmount(row.amountCop)}
                    </p>
                    <p className="text-xs text-muted">{formatUsdAmount(row.amountUsd)}</p>
                  </div>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 border-t border-default pt-2 text-sm">
              <span className="font-medium text-secondary">
                {t("admin.priceCalculator.lineWhatsappFee")}
              </span>
              <span className="font-semibold tabular-nums text-primary">
                {formatCopAmount(activeResult.whatsappFeeCop)}
              </span>
            </div>
          </div>

          {tab === "pro" ? (
            <p className="mt-5 text-xs text-muted">
              {t("admin.priceCalculator.overageHint", {
                count: proResult.overageMessages.toLocaleString(),
                whatsapp: proResult.whatsappMessages.toLocaleString(),
              })}
            </p>
          ) : (
            <p className="mt-5 text-xs text-muted">
              {t("admin.priceCalculator.resellerHint", {
                perSubaccount: formatCopAmount(resellerResult.costPerSubaccountCop),
              })}
            </p>
          )}
        </section>
      </div>
    </DashboardPage>
  );
}
