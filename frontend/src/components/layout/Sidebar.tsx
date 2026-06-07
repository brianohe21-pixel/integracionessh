"use client";

import type React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOutUser } from "@/lib/auth-session";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/context";
import {
  BotMessageSquare,
  MessageSquare,
  BookUser,
  LayoutTemplate,
  SendHorizonal,
  BarChart3,
  Settings,
  LogOut,
  Megaphone,
  Zap,
  GitBranch,
  LifeBuoy,
  Users,
  CreditCard,
  KeyRound,
  X,
} from "lucide-react";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useTenantRole } from "@/hooks/useTenantRole";
import { useSidebar } from "@/components/layout/SidebarContext";

const memberNavItems = [
  { href: "/bots", labelKey: "nav.bots" as const, icon: BotMessageSquare },
  { href: "/metrics", labelKey: "nav.metrics" as const, icon: BarChart3 },
  { href: "/conversations", labelKey: "nav.conversations" as const, icon: MessageSquare },
  { href: "/contacts", labelKey: "nav.contacts" as const, icon: BookUser },
  { href: "/advisors", labelKey: "nav.advisors" as const, icon: Users },
  { href: "/templates", labelKey: "nav.templates" as const, icon: LayoutTemplate },
  { href: "/bulk-send", labelKey: "nav.bulkSend" as const, icon: SendHorizonal },
  { href: "/campaigns", labelKey: "nav.campaigns" as const, icon: Megaphone },
  { href: "/automations", labelKey: "nav.automations" as const, icon: Zap },
  { href: "/flows", labelKey: "nav.flows" as const, icon: GitBranch },
  { href: "/developer", labelKey: "nav.developer" as const, icon: KeyRound },
  { href: "/support", labelKey: "nav.support" as const, icon: LifeBuoy },
  { href: "/billing", labelKey: "nav.billing" as const, icon: CreditCard },
  { href: "/settings", labelKey: "nav.settings" as const, icon: Settings },
];

const advisorNavItems = [
  { href: "/inbox", labelKey: "nav.inbox" as const, icon: MessageSquare },
];

const adminNavItems = [
  { href: "/admin/users", labelKey: "nav.adminUsers" as const, icon: Users },
  { href: "/admin/payments", labelKey: "nav.adminPayments" as const, icon: CreditCard },
  { href: "/admin/support", labelKey: "nav.adminSupport" as const, icon: LifeBuoy },
];

type NavItem = {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
};

function SidebarNav({
  navItems,
  onNavigate,
}: {
  navItems: NavItem[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useT();

  async function handleSignOut() {
    try {
      await signOutUser();
    } finally {
      router.push("/login");
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 space-y-2 border-t border-gray-800 px-3 py-4">
        <div className="flex gap-3 px-3 text-xs text-gray-500">
          <a href="/legal/terms" className="hover:text-gray-300">
            {t("legal.footerTerms")}
          </a>
          <a href="/legal/privacy" className="hover:text-gray-300">
            {t("legal.footerPrivacy")}
          </a>
        </div>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          {t("nav.signOut")}
        </button>
      </div>
    </div>
  );
}

export function Sidebar() {
  const t = useT();
  const { isOpen, close } = useSidebar();
  const { isAdmin, loading: adminLoading } = useAdminRole();
  const { isAdvisor, loading: roleLoading } = useTenantRole();

  const loading = adminLoading || roleLoading;
  const navItems = loading
    ? []
    : isAdmin
      ? adminNavItems
      : isAdvisor
        ? advisorNavItems
        : memberNavItems;

  const brand = (
    <div className="flex shrink-0 items-center gap-3 border-b border-gray-800 px-6 py-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600">
        <BotMessageSquare className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">{t("common.appName")}</p>
        <p className="text-xs text-gray-400">{t("common.appTagline")}</p>
      </div>
      <button
        type="button"
        onClick={close}
        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white lg:hidden"
        aria-label={t("nav.closeMenu")}
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-hidden bg-gray-900 text-white lg:flex">
        {brand}
        <SidebarNav navItems={navItems} />
      </aside>

      {isOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={close}
          aria-label={t("nav.closeMenu")}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-screen w-72 flex-col overflow-hidden bg-gray-900 text-white transition-transform duration-200 lg:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {brand}
        <SidebarNav navItems={navItems} onNavigate={close} />
      </aside>
    </>
  );
}
