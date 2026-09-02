"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Headphones, PhoneCall, Search, Settings } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import type { Bot } from "@/types";
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

function formatCost(amount: string, currency: string) {
  const value = Number(amount);
  if (Number.isNaN(value)) return `${amount} ${currency}`;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

interface ContactCenterPhoneNumbersTabProps {
  bots: Bot[];
  selectedBotId: string;
  onBotChange: (botId: string) => void;
}

export function ContactCenterPhoneNumbersTab({
  bots,
  selectedBotId,
  onBotChange,
}: ContactCenterPhoneNumbersTabProps) {
  const t = useT();
  const { data: credentials } = useProviderCredentials();
  const telnyxStatus = credentials?.items.find((item) => item.provider === "telnyx");
  const ownTelnyx = telnyxStatus?.configured && telnyxStatus.source === "own";

  const activeBotId = selectedBotId || bots[0]?.botId || "";
  const { data: settings } = useTelephonySettings(activeBotId);
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

  function handleAssign(assignAndEnable = false) {
    if (!activeBotId) return;
    if (!selectedNumber.trim()) {
      setError(t("telephony.phoneNumberRequired"));
      return;
    }
    setError("");
    save.mutate(
      {
        telephonyPhoneNumber: selectedNumber.trim(),
        ...(assignAndEnable ? { enabled: true } : {}),
      },
      {
        onSuccess: () => {
          setSuccess(t("telephony.saved"));
          setTimeout(() => setSuccess(""), 3000);
        },
        onError: (err) => setError(err.message),
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

  if (bots.length === 0) {
    return (
      <EmptyState
        icon={<Headphones className="h-5 w-5" />}
        title={t("contactCenter.numbersNoBots")}
        description={t("contactCenter.numbersNoBotsDesc")}
      />
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>
      ) : null}
      {success ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {success}
        </div>
      ) : null}

      <Card padding="md" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-primary">{t("contactCenter.numbersTitle")}</h3>
            <p className="text-sm text-secondary">{t("contactCenter.numbersSubtitle")}</p>
          </div>
          <Select value={activeBotId} onChange={(event) => onBotChange(event.target.value)}>
            {bots.map((bot) => (
              <option key={bot.botId} value={bot.botId}>
                {bot.name}
              </option>
            ))}
          </Select>
        </div>

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

        {telnyxStatus?.configured ? (
          <>
            <div className="rounded-lg border border-default bg-surface-muted/40 p-3 text-sm">
              <p className="font-medium text-primary">{t("contactCenter.numbersCurrentAgent")}</p>
              <p className="text-secondary">
                {currentNumber
                  ? t("contactCenter.numbersCurrentValue", { number: currentNumber })
                  : t("contactCenter.numbersNoCurrent")}
              </p>
            </div>

            {numbersLoading ? (
              <div className="h-20 animate-pulse rounded bg-surface-muted" />
            ) : (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-primary">{t("telephonyNumbers.inventoryTitle")}</h4>
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
                          className="grid gap-2 rounded-lg border border-default px-3 py-2 text-sm sm:grid-cols-[1fr_auto]"
                        >
                          <div>
                            <span className="font-medium text-primary">{item.phoneNumber}</span>
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
                                disabled={Boolean(isAssignedElsewhere) || save.isPending}
                                onClick={() => {
                                  setSelectedNumber(item.phoneNumber);
                                  handleAssign(true);
                                }}
                              >
                                {t("contactCenter.numbersAssignAgent")}
                              </Button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            <div className="space-y-3 border-t border-subtle pt-4">
              <h4 className="text-sm font-semibold text-primary">{t("telephonyNumbers.assignTitle")}</h4>
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
              <Button disabled={save.isPending || !activeBotId} onClick={() => handleAssign(true)}>
                {t("contactCenter.numbersAssignAndEnable")}
              </Button>
            </div>

            {ownTelnyx ? (
              <div className="space-y-3 border-t border-subtle pt-4">
                <h4 className="text-sm font-semibold text-primary">{t("telephonyNumbers.searchTitle")}</h4>
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
              </div>
            ) : null}
          </>
        ) : null}
      </Card>

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
