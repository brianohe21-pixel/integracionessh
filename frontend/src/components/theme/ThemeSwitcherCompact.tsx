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

type Props = {
  collapsed?: boolean;
};

export function ThemeSwitcherCompact({ collapsed = false }: Props) {
  const t = useT();
  const { preference, setPreference } = useTheme();

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg bg-sidebar-muted p-0.5",
        collapsed ? "flex-col" : "w-full"
      )}
      role="group"
      aria-label={t("settings.themeTitle")}
    >
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = preference === opt.value;
        const label = t(opt.labelKey);
        return (
          <button
            key={opt.value}
            type="button"
            title={label}
            aria-label={label}
            onClick={() => setPreference(opt.value)}
            className={cn(
              "inline-flex items-center justify-center rounded-md transition-colors",
              collapsed ? "h-8 w-8" : "flex-1 gap-1.5 px-2 py-1.5 text-xs font-medium",
              active
                ? "bg-sidebar-elevated text-brand-primary shadow-sm"
                : "text-[var(--sidebar-text-muted)] hover:bg-sidebar-hover hover:text-[var(--sidebar-text-secondary)]"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {!collapsed ? <span className="truncate">{label}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
