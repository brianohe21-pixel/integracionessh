"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PhoneCall, Search, Settings } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useDialog } from "@/components/ui/DialogProvider";
import { useProviderCredentials } from "@/hooks/useProviderCredentials";
import {
  usePurchaseTelephonyNumber,
  useSaveTelephonySettings,
  useSearchAvailableTelephonyNumbers,
  useTelephonyNumberOrder,
  useTelephonyNumbers,
  useTelephonySettings,
  type TelnyxAvailableNumber,
} from "@/hooks/useTelephony";
import { useT } from "@/i18n/context";
import { formatTelephonyError } from "@/lib/telnyx-errors";
import { getTelephonyNumberAssignment } from "@/lib/telephony-number-assignment";
import type { Bot } from "@/types";

function SettingsSwitch({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${
        checked ? "bg-accent" : "bg-gray-200"
      } ${disabled ? "opacity-50" : ""}`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface-elevated shadow transition ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function formatCost(amount: string, currency: string) {
  const value = Number(amount);
  if (Number.isNaN(value)) return `${amount} ${currency}`;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

interface VoiceAgentPhoneNumbersPanelProps {
  botId: string;
  bots?: Bot[];
  onBotChange?: (botId: string) => void;
}

export function VoiceAgentPhoneNumbersPanel({
  botId,
  bots,
  onBotChange,
}: VoiceAgentPhoneNumbersPanelProps) {
  const t = useT();
  const dialog = useDialog();
  const activeBotId = botId;
  const { data: credentials } = useProviderCredentials();
  const telnyxStatus = credentials?.items.find((item) => item.provider === "telnyx");
  const ownTelnyx = telnyxStatus?.configured && telnyxStatus.source === "own";

  const { data: settings, isLoading: settingsLoading } = useTelephonySettings(activeBotId);
  const { data: numbersData, isLoading: numbersLoading } = useTelephonyNumbers();
  const save = useSaveTelephonySettings(activeBotId);
  const search = useSearchAvailableTelephonyNumbers();
  const purchase = usePurchaseTelephonyNumber();

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedNumber, setSelectedNumber] = useState("");
  const [countryCode, setCountryCode] = useState("US");
  const [phoneNumberType, setPhoneNumberType] = useState<"local" | "toll_free">("local");
  const [locality, setLocality] = useState("");
  const [areaCode, setAreaCode] = useState("");
  const [searchResults, setSearchResults] = useState<TelnyxAvailableNumber[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [confirmNumber, setConfirmNumber] = useState<TelnyxAvailableNumber | null>(null);

  const orderQuery = useTelephonyNumberOrder(pendingOrderId);

  const numbers = useMemo(() => numbersData?.numbers ?? [], [numbersData?.numbers]);
  const enabled = Boolean(settings?.telephonyEnabled);
  const currentNumber = settings?.telephonyPhoneNumber ?? "";

  useEffect(() => {
    if (!settings) return;
    setSelectedNumber(settings.telephonyPhoneNumber ?? "");
  }, [settings, activeBotId]);

  useEffect(() => {
    if (!orderQuery.data) return;
    if (orderQuery.data.status === "success") {
      setPendingOrderId(null);
      setSuccess(t("telephonyNumbers.orderSuccess"));
      setSearchResults([]);
      setHasSearched(false);
      setTimeout(() => setSuccess(""), 4000);
    }
    if (orderQuery.data.status === "failure") {
      setPendingOrderId(null);
      setError(t("telephonyNumbers.orderFailed"));
    }
  }, [orderQuery.data, t]);

  async function handleAssign(assignAndEnable = false) {
    if (!selectedNumber.trim()) {
      setError(t("telephony.phoneNumberRequired"));
      return;
    }
    const conflict = getTelephonyNumberAssignment(numbers, selectedNumber.trim(), activeBotId);
    if (conflict) {
      const confirmed = await dialog.confirm({
        title: t("telephony.reassignNumberTitle"),
        description: t("telephony.reassignNumberConfirm", {
          number: selectedNumber.trim(),
          name: conflict.botName ?? conflict.botId,
        }),
        tone: "warning",
      });
      if (!confirmed) return;
    }
    setError("");
    save.mutate(
      {
        telephonyPhoneNumber: selectedNumber.trim(),
        ...(assignAndEnable ? { enabled: true } : {}),
        ...(conflict ? { reassignPhoneNumber: true } : {}),
      },
      {
        onSuccess: () => {
          setSuccess(t("telephony.saved"));
          setTimeout(() => setSuccess(""), 3000);
        },
        onError: (err) => setError(formatTelephonyError(err.message, t)),
      }
    );
  }

  async function handleEnabledChange(next: boolean) {
    if (next) {
      if (!selectedNumber.trim()) {
        setError(t("telephony.phoneNumberRequired"));
        return;
      }
      const conflict = getTelephonyNumberAssignment(numbers, selectedNumber.trim(), activeBotId);
      if (conflict) {
        const confirmed = await dialog.confirm({
          title: t("telephony.reassignNumberTitle"),
          description: t("telephony.reassignNumberConfirm", {
            number: selectedNumber.trim(),
            name: conflict.botName ?? conflict.botId,
          }),
          tone: "warning",
        });
        if (!confirmed) return;
      }
      setError("");
      save.mutate(
        {
          telephonyPhoneNumber: selectedNumber.trim(),
          enabled: true,
          ...(conflict ? { reassignPhoneNumber: true } : {}),
        },
        {
          onSuccess: () => {
            setSuccess(t("telephony.saved"));
            setTimeout(() => setSuccess(""), 3000);
          },
          onError: (err) => setError(formatTelephonyError(err.message, t)),
        }
      );
      return;
    }
    setError("");
    save.mutate(
      { enabled: false },
      {
        onSuccess: () => {
          setSuccess(t("telephony.saved"));
          setTimeout(() => setSuccess(""), 3000);
        },
        onError: (err) => setError(formatTelephonyError(err.message, t)),
      }
    );
  }

  async function runSearch() {
    setError("");
    try {
      const result = await search.mutateAsync({
        countryCode: countryCode.trim().toUpperCase(),
        phoneNumberType,
        ...(locality.trim() ? { locality: locality.trim() } : {}),
        ...(areaCode.trim() ? { nationalDestinationCode: areaCode.trim() } : {}),
        limit: 20,
      });
      setSearchResults(result.numbers);
      setHasSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("telephonyNumbers.searchFailed"));
    }
  }

  async function confirmPurchase() {
    if (!confirmNumber) return;
    setError("");
    try {
      const order = await purchase.mutateAsync(confirmNumber.phoneNumber);
      setConfirmNumber(null);
      setPendingOrderId(order.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("telephonyNumbers.orderFailed"));
    }
  }

  if (!activeBotId && bots && bots.length === 0) {
    return (
      <EmptyState
        icon={<PhoneCall className="h-5 w-5" />}
        title={t("contactCenter.numbersNoBots")}
        description={t("contactCenter.numbersNoBotsDesc")}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="content-card space-y-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <PhoneCall className="h-5 w-5 text-accent" />
            <div>
              <h2 className="text-lg font-semibold text-primary">{t("voiceAgents.numbersTitle")}</h2>
              <p className="text-sm text-secondary">{t("voiceAgents.numbersSubtitle")}</p>
            </div>
          </div>
          {bots && onBotChange && bots.length > 0 ? (
            <Select value={activeBotId} onChange={(event) => onBotChange(event.target.value)}>
              {bots.map((bot) => (
                <option key={bot.botId} value={bot.botId}>
                  {bot.name}
                </option>
              ))}
            </Select>
          ) : null}
        </div>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {success}
          </div>
        ) : null}

        {!telnyxStatus?.configured ? (
          <EmptyState
            icon={<PhoneCall className="h-5 w-5" />}
            title={t("telephonyNumbers.noTelnyx")}
            description={t("telephonyNumbers.noTelnyxDesc")}
            action={
              <Link
                href="/settings?tab=apiKeys"
                className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
              >
                <Settings className="h-4 w-4" />
                {t("voiceAgents.setupConnectTelnyx")}
              </Link>
            }
          />
        ) : null}

        {telnyxStatus?.configured && !ownTelnyx ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {t("telephonyNumbers.inheritedCredentials")}
            <Link href="/settings?tab=apiKeys" className="ml-1 font-medium text-accent hover:underline">
              {t("telephonyNumbers.connectOwnTelnyx")}
            </Link>
          </div>
        ) : null}

        {settingsLoading || numbersLoading ? (
          <div className="h-24 animate-pulse rounded bg-surface-muted" />
        ) : telnyxStatus?.configured ? (
          <>
            <Card padding="md" className="space-y-3">
              <h3 className="text-sm font-semibold text-primary">{t("telephonyNumbers.inventoryTitle")}</h3>
              {numbers.length === 0 ? (
                <p className="text-sm text-secondary">{t("telephonyNumbers.inventoryEmpty")}</p>
              ) : (
                <ul className="space-y-2">
                  {numbers.map((item) => {
                    const isCurrent = currentNumber === item.phoneNumber;
                    const isAssignedElsewhere =
                      item.assignedBotId && item.assignedBotId !== activeBotId;
                    return (
                      <li
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-default px-3 py-2 text-sm"
                      >
                        <div>
                          <span className="font-medium text-primary">{item.phoneNumber}</span>
                          <span className="ml-2 text-secondary">{item.status}</span>
                          {item.assignedBotName ? (
                            <span className="ml-2 text-xs text-muted">
                              {t("telephonyNumbers.assignedTo", { name: item.assignedBotName })}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex gap-2">
                          {isCurrent ? (
                            <span className="text-xs font-medium text-accent">
                              {t("telephonyNumbers.currentNumber")}
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={save.isPending}
                              onClick={() => {
                                setSelectedNumber(item.phoneNumber);
                                void handleAssign(false);
                              }}
                            >
                              {isAssignedElsewhere
                                ? t("telephony.reassignNumberAction")
                                : t("telephonyNumbers.assign")}
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card padding="md" className="space-y-4">
              <h3 className="text-sm font-semibold text-primary">{t("telephonyNumbers.assignTitle")}</h3>
              {numbers.length > 0 ? (
                <Select
                  value={selectedNumber}
                  onChange={(event) => setSelectedNumber(event.target.value)}
                >
                  {numbers.map((item) => (
                    <option key={item.id} value={item.phoneNumber}>
                      {item.phoneNumber}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  value={selectedNumber}
                  onChange={(event) => setSelectedNumber(event.target.value)}
                  placeholder="+17871234567"
                />
              )}
              <div className="flex flex-wrap gap-2">
                <Button disabled={save.isPending} onClick={() => void handleAssign(false)}>
                  {t("telephonyNumbers.saveAssignment")}
                </Button>
                <Button
                  variant="outline"
                  disabled={save.isPending || !selectedNumber.trim()}
                  onClick={() => void handleAssign(true)}
                >
                  {t("telephonyNumbers.assignAndEnable")}
                </Button>
              </div>
              <label className="flex items-center justify-between gap-4 border-t border-subtle pt-4">
                <div>
                  <p className="font-medium text-primary">{t("telephony.enableLabel")}</p>
                  <p className="text-sm text-secondary">{t("telephony.enableHint")}</p>
                </div>
                <SettingsSwitch
                  checked={enabled}
                  disabled={save.isPending || !selectedNumber.trim()}
                  onChange={handleEnabledChange}
                />
              </label>
            </Card>

            {ownTelnyx ? (
              <Card padding="md" className="space-y-4">
                <h3 className="text-sm font-semibold text-primary">{t("telephonyNumbers.searchTitle")}</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Input
                    value={countryCode}
                    onChange={(event) => setCountryCode(event.target.value)}
                    placeholder={t("telephonyNumbers.countryCode")}
                  />
                  <Select
                    value={phoneNumberType}
                    onChange={(event) =>
                      setPhoneNumberType(event.target.value as "local" | "toll_free")
                    }
                  >
                    <option value="local">{t("telephonyNumbers.typeLocal")}</option>
                    <option value="toll_free">{t("telephonyNumbers.typeTollFree")}</option>
                  </Select>
                  <Input
                    value={locality}
                    onChange={(event) => setLocality(event.target.value)}
                    placeholder={t("telephonyNumbers.locality")}
                  />
                  <Input
                    value={areaCode}
                    onChange={(event) => setAreaCode(event.target.value)}
                    placeholder={t("telephonyNumbers.areaCode")}
                  />
                </div>
                <Button onClick={() => void runSearch()} disabled={search.isPending}>
                  <Search className="h-4 w-4" />
                  {search.isPending ? t("telephonyNumbers.searching") : t("telephonyNumbers.search")}
                </Button>
                {pendingOrderId ? (
                  <p className="text-sm text-secondary">{t("telephonyNumbers.orderPending")}</p>
                ) : null}
                {searchResults.length > 0 ? (
                  <ul className="space-y-2">
                    {searchResults.map((item) => (
                      <li
                        key={item.phoneNumber}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-default px-3 py-2 text-sm"
                      >
                        <div>
                          <span className="font-medium text-primary">{item.phoneNumber}</span>
                          {item.regionName ? (
                            <span className="ml-2 text-secondary">{item.regionName}</span>
                          ) : null}
                          <p className="text-xs text-muted">
                            {t("telephonyNumbers.costSummary", {
                              upfront: formatCost(item.cost.upfrontCost, item.cost.currency),
                              monthly: formatCost(item.cost.monthlyCost, item.cost.currency),
                            })}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          disabled={purchase.isPending || Boolean(pendingOrderId)}
                          onClick={() => setConfirmNumber(item)}
                        >
                          {t("telephonyNumbers.buy")}
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : hasSearched ? (
                  <p className="text-sm text-secondary">{t("telephonyNumbers.searchEmpty")}</p>
                ) : null}
              </Card>
            ) : null}
          </>
        ) : null}
      </div>

      {confirmNumber ? (
        <Modal className="p-4">
          <div className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-default bg-surface-elevated shadow-xl">
            <div className="border-b border-default px-6 py-4">
              <h2 className="text-lg font-semibold text-primary">
                {t("telephonyNumbers.confirmPurchaseTitle")}
              </h2>
            </div>
            <div className="space-y-4 px-6 py-5">
              <p className="text-sm text-secondary">
                {t("telephonyNumbers.confirmPurchaseDesc", { number: confirmNumber.phoneNumber })}
              </p>
              <p className="text-sm font-medium text-primary">
                {t("telephonyNumbers.costSummary", {
                  upfront: formatCost(confirmNumber.cost.upfrontCost, confirmNumber.cost.currency),
                  monthly: formatCost(confirmNumber.cost.monthlyCost, confirmNumber.cost.currency),
                })}
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setConfirmNumber(null)}>
                  {t("common.cancel")}
                </Button>
                <Button disabled={purchase.isPending} onClick={() => void confirmPurchase()}>
                  {purchase.isPending ? t("telephonyNumbers.purchasing") : t("telephonyNumbers.confirmBuy")}
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
