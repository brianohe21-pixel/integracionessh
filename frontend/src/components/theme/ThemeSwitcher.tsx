"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";
import type { ThemePreference } from "@/lib/theme";
import { useTheme } from "@/components/theme/ThemeProvider";

const options: {
  value: ThemePreference;
  labelKey: "settings.themeLight" | "settings.themeDark" | "settings.themeSystem";
  icon: typeof Sun;
}[] = [
  { value: "light", labelKey: "settings.themeLight", icon: Sun },
  { value: "dark", labelKey: "settings.themeDark", icon: Moon },
  { value: "system", labelKey: "settings.themeSystem", icon: Monitor },
];

export function ThemeSwitcher() {
  const t = useT();
  const { preference, setPreference } = useTheme();

  return (
    <div
      className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-surface-muted p-0.5"
      role="group"
      aria-label={t("settings.themeTitle")}
    >
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = preference === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setPreference(opt.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-surface-elevated text-accent shadow-sm"
                : "text-secondary hover:text-primary"
            )}
          >
            <Icon className="h-4 w-4" />
            {t(opt.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
