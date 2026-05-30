"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "aws-amplify/auth";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/context";
import {
  BotMessageSquare,
  MessageSquare,
  LayoutTemplate,
  SendHorizonal,
  BarChart3,
  Settings,
  LogOut,
} from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useT();

  const navItems = [
    { href: "/bots", labelKey: "nav.bots" as const, icon: BotMessageSquare },
    { href: "/metrics", labelKey: "nav.metrics" as const, icon: BarChart3 },
    { href: "/conversations", labelKey: "nav.conversations" as const, icon: MessageSquare },
    { href: "/templates", labelKey: "nav.templates" as const, icon: LayoutTemplate },
    { href: "/bulk-send", labelKey: "nav.bulkSend" as const, icon: SendHorizonal },
    { href: "/settings", labelKey: "nav.settings" as const, icon: Settings },
  ];

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-gray-900 text-white">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-800">
        <div className="flex items-center justify-center w-9 h-9 bg-indigo-600 rounded-xl">
          <BotMessageSquare className="w-5 h-5" />
        </div>
        <div>
          <p className="font-semibold text-sm leading-tight">{t("common.appName")}</p>
          <p className="text-xs text-gray-400">{t("common.appTagline")}</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-gray-800">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4" />
          {t("nav.signOut")}
        </button>
      </div>
    </aside>
  );
}
