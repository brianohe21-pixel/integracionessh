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
  UserPlus,
  LayoutTemplate,
  SendHorizonal,
  LayoutGrid,
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
  User,
} from "lucide-react";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useTenantRole } from "@/hooks/useTenantRole";
import { useTenantBranding } from "@/hooks/useTenantBranding";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useSidebar } from "@/components/layout/SidebarContext";

const memberNavItems = [
  { href: "/bots", labelKey: "nav.bots" as const, icon: BotMessageSquare },
  { href: "/metrics", labelKey: "nav.metrics" as const, icon: BarChart3 },
  { href: "/conversations", labelKey: "nav.conversations" as const, icon: MessageSquare },
  { href: "/contacts", labelKey: "nav.contacts" as const, icon: BookUser },
  { href: "/leads", labelKey: "nav.leads" as const, icon: UserPlus },
  { href: "/advisors", labelKey: "nav.advisors" as const, icon: Users },
  { href: "/templates", labelKey: "nav.templates" as const, icon: LayoutTemplate },
  { href: "/bulk-send", labelKey: "nav.bulkSend" as const, icon: SendHorizonal },
  { href: "/campaigns", labelKey: "nav.campaigns" as const, icon: Megaphone },
  { href: "/automations", labelKey: "nav.automations" as const, icon: Zap },
  { href: "/flows", labelKey: "nav.flows" as const, icon: GitBranch },
  { href: "/apps", labelKey: "nav.apps" as const, icon: LayoutGrid },
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

function roleLabel(role: string, t: ReturnType<typeof useT>): string {
  if (role === "admin") return t("nav.roleAdmin");
  if (role === "advisor") return t("nav.roleAdvisor");
  return t("nav.roleMember");
}

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
    onNavigate?.();
    try {
      await signOutUser();
    } finally {
      router.push("/login");
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-3 py-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent text-white shadow-sm shadow-accent/20"
                  : "text-secondary hover:bg-surface-muted hover:text-primary"
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 space-y-2 border-t border-default px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex gap-3 px-3 text-xs text-muted">
          <a href="/legal/terms" className="hover:text-secondary">
            {t("legal.footerTerms")}
          </a>
          <a href="/legal/privacy" className="hover:text-secondary">
            {t("legal.footerPrivacy")}
          </a>
        </div>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-secondary transition-colors hover:bg-surface-muted hover:text-primary"
        >
          <LogOut className="h-4 w-4" />
          {t("nav.signOut")}
        </button>
      </div>
    </div>
  );
}

function SidebarUserProfile() {
  const t = useT();
  const { user, loading } = useCurrentUser();
  const { role } = useTenantRole();

  const displayName = user?.name || user?.email;

  return (
    <div className="flex items-center gap-3 border-t border-default px-4 py-3">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent-muted text-sm font-semibold text-accent">
        {loading ? (
          <User className="h-4 w-4 text-secondary" />
        ) : (
          (displayName?.charAt(0) ?? "?").toUpperCase()
        )}
      </div>
      <div className="min-w-0 flex-1">
        {loading ? (
          <>
            <div className="mb-1.5 h-3.5 w-24 animate-pulse rounded bg-surface-muted" />
            <div className="h-3 w-16 animate-pulse rounded bg-surface-muted" />
          </>
        ) : displayName ? (
          <>
            <p className="truncate text-sm font-medium text-primary">{displayName}</p>
            <p className="truncate text-xs text-muted">
              {user?.email && user.email !== displayName ? user.email : roleLabel(role, t)}
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function Sidebar() {
  const t = useT();
  const { isOpen, close } = useSidebar();
  const { isAdmin, loading: adminLoading } = useAdminRole();
  const { isAdvisor, loading: roleLoading } = useTenantRole();
  const { data: branding } = useTenantBranding();

  const loading = adminLoading || roleLoading;
  const navItems = loading
    ? []
    : isAdmin
      ? adminNavItems
      : isAdvisor
        ? advisorNavItems
        : memberNavItems;

  const displayName = branding?.brandName ?? t("common.appName");

  const brand = (
    <div className="flex shrink-0 items-center gap-3 border-b border-default px-5 py-4">
      <div
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl"
        style={{ backgroundColor: "var(--brand-primary, #25D366)" }}
      >
        {branding?.logoUrl ? (
          <img src={branding.logoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <BotMessageSquare className="h-5 w-5 text-white" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight text-primary">{displayName}</p>
        <p className="text-xs text-muted">{t("common.appTagline")}</p>
      </div>
      <button
        type="button"
        onClick={close}
        className="rounded-lg p-1.5 text-secondary hover:bg-surface-muted hover:text-primary lg:hidden"
        aria-label={t("nav.closeMenu")}
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );

  const sidebarContent = (
    <>
      {brand}
      <SidebarNav navItems={navItems} />
      <SidebarUserProfile />
    </>
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-hidden border-r border-default bg-surface lg:flex">
        {sidebarContent}
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
          "fixed inset-y-0 left-0 z-50 flex h-[100dvh] w-72 min-h-0 flex-col overflow-hidden border-r border-default bg-surface transition-transform duration-200 lg:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {brand}
        <SidebarNav navItems={navItems} onNavigate={close} />
        <SidebarUserProfile />
      </aside>
    </>
  );
}
