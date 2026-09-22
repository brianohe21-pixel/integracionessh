"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Check, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { SearchInput } from "@/components/ui/SearchInput";
import { useT } from "@/i18n/context";
import {
  AI_MODEL_CATEGORIES,
  groupModelsByCategory,
  type AiModelCategory,
  type AiModelDefinition,
} from "@/lib/ai-models";
import { cn } from "@/lib/utils";

type CategoryFilter = "all" | AiModelCategory;

type AiModelPickerProps = {
  value: string;
  onChange: (modelId: string) => void;
  models: AiModelDefinition[];
  disabled?: boolean;
};

function categoryBadgeVariant(
  category: AiModelCategory
): "accent" | "info" | "warning" | "default" {
  if (category === "flagship") return "info";
  if (category === "reasoning") return "warning";
  if (category === "economy") return "accent";
  return "default";
}

function categoryDescriptionKey(category: AiModelCategory): string {
  return `voiceAgents.chatModelDesc_${category}`;
}

function SelectionIndicator({ selected }: { selected: boolean }) {
  return (
    <span
      className={cn(
        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
        selected ? "border-accent bg-accent text-white" : "border-default bg-surface"
      )}
    >
      {selected ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
    </span>
  );
}

function FilterChip({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-full px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-accent text-white"
          : "bg-surface-muted text-secondary hover:bg-surface-muted/80 hover:text-primary",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      {children}
    </button>
  );
}

export function AiModelPicker({ value, onChange, models, disabled }: AiModelPickerProps) {
  const t = useT();
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [search, setSearch] = useState("");

  const modelsByCategory = useMemo(() => groupModelsByCategory(models), [models]);
  const selectedModel = models.find((model) => model.id === value);

  const categoriesWithModels = AI_MODEL_CATEGORIES.filter(
    (category) => (modelsByCategory[category]?.length ?? 0) > 0
  );

  const filteredModels = useMemo(() => {
    const base =
      categoryFilter === "all" ? models : (modelsByCategory[categoryFilter] ?? []);
    const query = search.trim().toLowerCase();
    if (!query) return base;
    return base.filter(
      (model) =>
        model.label.toLowerCase().includes(query) || model.id.toLowerCase().includes(query)
    );
  }, [categoryFilter, models, modelsByCategory, search]);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <span className="text-sm font-medium text-secondary">{t("bots.model")}</span>
        <p className="text-xs text-secondary">{t("bots.modelSelectHint")}</p>
      </div>

      {selectedModel ? (
        <div className="flex items-start gap-3 rounded-xl border border-accent/25 bg-gradient-to-br from-accent-muted/40 to-surface p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-muted text-accent">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold text-primary">{selectedModel.label}</span>
              <Badge variant={categoryBadgeVariant(selectedModel.category)}>
                {t(`bots.modelCategory.${selectedModel.category}`)}
              </Badge>
            </div>
            <p className="text-sm leading-relaxed text-secondary">
              {t(categoryDescriptionKey(selectedModel.category))}
            </p>
            <p className="font-mono text-xs text-muted">{selectedModel.id}</p>
          </div>
        </div>
      ) : null}

      <SearchInput
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        onClear={() => setSearch("")}
        placeholder={t("bots.modelSearchPlaceholder")}
        disabled={disabled}
      />

      <div className="flex flex-wrap gap-1.5">
        <FilterChip
          active={categoryFilter === "all"}
          onClick={() => setCategoryFilter("all")}
          disabled={disabled}
        >
          {t("bots.modelFilterAll")} ({models.length})
        </FilterChip>
        {categoriesWithModels.map((category) => (
          <FilterChip
            key={category}
            active={categoryFilter === category}
            onClick={() => setCategoryFilter(category)}
            disabled={disabled}
          >
            {t(`bots.modelCategory.${category}`)} ({modelsByCategory[category]?.length ?? 0})
          </FilterChip>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-default bg-surface">
        {filteredModels.length > 0 ? (
          <ul className="max-h-72 overflow-y-auto">
            {filteredModels.map((model) => {
              const selected = model.id === value;
              return (
                <li key={model.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(model.id)}
                    className={cn(
                      "flex w-full gap-3 border-b border-default px-4 py-3 text-left transition-colors last:border-b-0",
                      selected ? "bg-accent-muted/50" : "hover:bg-surface-muted/60",
                      disabled && "cursor-not-allowed opacity-60"
                    )}
                  >
                    <SelectionIndicator selected={selected} />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-primary">{model.label}</span>
                        <Badge variant={categoryBadgeVariant(model.category)}>
                          {t(`bots.modelCategory.${model.category}`)}
                        </Badge>
                      </div>
                      <p className="text-xs text-secondary line-clamp-1">
                        {t(categoryDescriptionKey(model.category))}
                      </p>
                      <p className="font-mono text-[11px] text-muted">{model.id}</p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-muted">{t("bots.modelSearchEmpty")}</p>
        )}
      </div>
    </div>
  );
}
