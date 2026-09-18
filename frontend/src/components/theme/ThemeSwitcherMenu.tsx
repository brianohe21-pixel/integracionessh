"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";
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

const menuItemClass =
  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-secondary transition-colors hover:bg-surface-muted hover:text-primary";

export function ThemeSwitcherMenu() {
  const t = useT();
  const { preference, setPreference } = useTheme();

  return (
    <div className="px-1.5">
      <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
        {t("settings.themeTitle")}
      </p>
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = preference === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="menuitemradio"
            aria-checked={active}
            onClick={() => setPreference(opt.value)}
            className={cn(menuItemClass, active && "bg-surface-muted text-primary")}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1">{t(opt.labelKey)}</span>
            {active ? <Check className="h-4 w-4 shrink-0 text-accent" /> : null}
          </button>
        );
      })}
    </div>
  );
}
