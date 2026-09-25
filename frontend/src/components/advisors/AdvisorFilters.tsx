"use client";

import { FilterX } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { SearchInput } from "@/components/ui/SearchInput";
import { useT } from "@/i18n/context";
import type { AdvisorAccessFilter, AdvisorFilterState, AdvisorStatusFilter } from "@/lib/advisor-filters";
import { hasAdvisorFilters } from "@/lib/advisor-filters";

type Props = {
  filters: AdvisorFilterState;
  bots: Array<{ botId: string; name: string }>;
  onChange: (patch: Partial<AdvisorFilterState>) => void;
  onClear: () => void;
};

export function AdvisorFilters({ filters, bots, onChange, onClear }: Props) {
  const t = useT();

  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <SearchInput
        value={filters.search}
        onChange={(event) => onChange({ search: event.target.value })}
        placeholder={t("advisors.searchPlaceholder")}
        onClear={() => onChange({ search: "" })}
        className="sm:min-w-[240px] sm:flex-1"
      />
      <Select
        value={filters.status}
        onChange={(event) => onChange({ status: event.target.value as AdvisorStatusFilter })}
        className="sm:w-auto sm:min-w-[160px]"
      >
        <option value="">{t("advisors.filterAllStatus")}</option>
        <option value="active">{t("advisors.online")}</option>
        <option value="inactive">{t("advisors.offline")}</option>
      </Select>
      <Select
        value={filters.botId}
        onChange={(event) => onChange({ botId: event.target.value })}
        className="sm:w-auto sm:min-w-[160px]"
      >
        <option value="">{t("advisors.filterAllBots")}</option>
        {bots.map((bot) => (
          <option key={bot.botId} value={bot.botId}>
            {bot.name}
          </option>
        ))}
      </Select>
      <Select
        value={filters.access}
        onChange={(event) => onChange({ access: event.target.value as AdvisorAccessFilter })}
        className="sm:w-auto sm:min-w-[180px]"
      >
        <option value="">{t("advisors.filterAllAccess")}</option>
        <option value="panel">{t("advisors.filterPanelAccess")}</option>
        <option value="none">{t("advisors.filterNoPanelAccess")}</option>
      </Select>
      {hasAdvisorFilters(filters) && (
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          <FilterX className="h-4 w-4" />
          {t("common.clearFilters")}
        </Button>
      )}
    </div>
  );
}
