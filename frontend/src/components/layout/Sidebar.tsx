"use client";

import type React from "react";
import { useEffect, useState } from "react";
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
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useTenantRole } from "@/hooks/useTenantRole";
import { useTenantBranding } from "@/hooks/useTenantBranding";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useSidebar } from "@/components/layout/SidebarContext";
import { useQuery } from "@tanstack/react-query";
import { api, getTenantContext } from "@/lib/api";
import type { Tenant } from "@/types";
import { useClearTenantContext } from "@/hooks/useReseller";

type NavItem = {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavCategory = {
  id: string;
  labelKey: string;
  items: NavItem[];
};

const memberNavCategories: NavCategory[] = [
  {
    id: "messaging",
    labelKey: "nav.categoryMessaging",
    items: [
      { href: "/bots", labelKey: "nav.bots", icon: BotMessageSquare },
      { href: "/conversations", labelKey: "nav.conversations", icon: MessageSquare },
      { href: "/supervisor", labelKey: "nav.supervisor", icon: LayoutGrid },
      { href: "/contacts", labelKey: "nav.contacts", icon: BookUser },
      { href: "/leads", labelKey: "nav.leads", icon: UserPlus },
      { href: "/advisors", labelKey: "nav.advisors", icon: Users },
    ],
  },
  {
    id: "outreach",
    labelKey: "nav.categoryOutreach",
    items: [
      { href: "/templates", labelKey: "nav.templates", icon: LayoutTemplate },
      { href: "/bulk-send", labelKey: "nav.bulkSend", icon: SendHorizonal },
      { href: "/campaigns", labelKey: "nav.campaigns", icon: Megaphone },
    ],
  },
  {
    id: "automation",
    labelKey: "nav.categoryAutomation",
    items: [
      { href: "/automations", labelKey: "nav.automations", icon: Zap },
      { href: "/flows", labelKey: "nav.flows", icon: GitBranch },
    ],
  },
  {
    id: "insights",
    labelKey: "nav.categoryInsights",
    items: [{ href: "/metrics", labelKey: "nav.metrics", icon: BarChart3 }],
  },
  {
    id: "integrations",
    labelKey: "nav.categoryIntegrations",
    items: [
      { href: "/apps", labelKey: "nav.apps", icon: LayoutGrid },
      { href: "/developer", labelKey: "nav.developer", icon: KeyRound },
    ],
  },
  {
    id: "account",
    labelKey: "nav.categoryAccount",
    items: [
      { href: "/support", labelKey: "nav.support", icon: LifeBuoy },
      { href: "/billing", labelKey: "nav.billing", icon: CreditCard },
      { href: "/settings", labelKey: "nav.settings", icon: Settings },
    ],
  },
];

const resellerAccountItem: NavItem = {
  href: "/subaccounts",
  labelKey: "nav.subaccounts",
  icon: Users,
};

const advisorNavCategories: NavCategory[] = [
  {
    id: "inbox",
    labelKey: "nav.categoryMessaging",
    items: [{ href: "/inbox", labelKey: "nav.inbox", icon: MessageSquare }],
  },
];

const adminNavCategories: NavCategory[] = [
  {
    id: "admin",
    labelKey: "nav.categoryAdmin",
    items: [
      { href: "/admin/users", labelKey: "nav.adminUsers", icon: Users },
      { href: "/admin/payments", labelKey: "nav.adminPayments", icon: CreditCard },
      { href: "/admin/support", labelKey: "nav.adminSupport", icon: LifeBuoy },
    ],
  },
];

function roleLabel(role: string, t: ReturnType<typeof useT>): string {
  if (role === "admin") return t("nav.roleAdmin");
  if (role === "advisor") return t("nav.roleAdvisor");
  return t("nav.roleMember");
}

function getActiveCategoryIds(pathname: string, categories: NavCategory[]): Set<string> {
  const active = new Set<string>();
  for (const category of categories) {
    if (category.items.some((item) => pathname.startsWith(item.href))) {
      active.add(category.id);
    }
  }
  if (active.size === 0 && categories.length > 0) {
    active.add(categories[0].id);
  }
  return active;
}

function NavLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const t = useT();
  const Icon = item.icon;
  const label = t(item.labelKey);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      aria-label={label}
      className={cn(
        "flex items-center rounded-lg py-2 text-[13px] transition-all duration-150",
        collapsed ? "justify-center px-2" : "gap-2.5 px-2.5",
        active
          ? "bg-brand-primary font-semibold text-[var(--sidebar-icon-active)] shadow-[0_1px_0_rgba(255,255,255,0.08)_inset]"
          : "font-medium text-[var(--sidebar-text-secondary)] hover:bg-white/5 hover:text-[var(--sidebar-text)]"
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 stroke-[2]",
          active ? "text-[var(--sidebar-icon-active)]" : "text-[var(--sidebar-icon)]"
        )}
      />
      {!collapsed ? <span className="truncate">{label}</span> : null}
    </Link>
  );
}

function SidebarNav({
  navCategories,
  collapsed,
  onNavigate,
}: {
  navCategories: NavCategory[];
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useT();
  const [openCategories, setOpenCategories] = useState<Set<string>>(() =>
    getActiveCategoryIds(pathname, navCategories)
  );

  useEffect(() => {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      for (const id of getActiveCategoryIds(pathname, navCategories)) {
        next.add(id);
      }
      return next;
    });
  }, [pathname, navCategories]);

  function toggleCategory(id: string) {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

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
      <nav
        className={cn(
          "sidebar-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain py-3",
          collapsed ? "space-y-3 px-2" : "space-y-1 px-3"
        )}
      >
        {navCategories.map((category, index) => {
          const isOpen = openCategories.has(category.id);
          const hasActiveItem = category.items.some((item) =>
            pathname.startsWith(item.href)
          );

          if (collapsed) {
            return (
              <div
                key={category.id}
                className={cn(
                  index > 0 && "border-t border-[var(--sidebar-border)] pt-3"
                )}
              >
                <div className="space-y-0.5">
                  {category.items.map((item) => (
                    <NavLink
                      key={item.href}
                      item={item}
                      active={pathname.startsWith(item.href)}
                      collapsed
                      onNavigate={onNavigate}
                    />
                  ))}
                </div>
              </div>
            );
          }

          return (
            <div key={category.id} className="space-y-0.5">
              <button
                type="button"
                onClick={() => toggleCategory(category.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors",
                  hasActiveItem
                    ? "text-brand-primary"
                    : "text-[var(--sidebar-text-muted)] hover:bg-white/5 hover:text-[var(--sidebar-text-secondary)]"
                )}
              >
                {isOpen ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="truncate">{t(category.labelKey)}</span>
              </button>
              <div
                className={cn(
                  "space-y-0.5 overflow-hidden pl-0.5 transition-all duration-200",
                  isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                )}
              >
                {category.items.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    active={pathname.startsWith(item.href)}
                    collapsed={false}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      <div
        className={cn(
          "shrink-0 border-t border-[var(--sidebar-border)] py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          collapsed ? "px-2" : "px-3"
        )}
      >
        {!collapsed ? (
          <div className="mb-2 flex gap-3 px-2.5 text-[11px] text-[var(--sidebar-text-muted)]">
            <a
              href="/legal/terms"
              className="transition-colors hover:text-[var(--sidebar-text-secondary)]"
            >
              {t("legal.footerTerms")}
            </a>
            <a
              href="/legal/privacy"
              className="transition-colors hover:text-[var(--sidebar-text-secondary)]"
            >
              {t("legal.footerPrivacy")}
            </a>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => void handleSignOut()}
          title={collapsed ? t("nav.signOut") : undefined}
          className={cn(
            "flex w-full items-center rounded-lg py-2 text-[13px] font-medium text-[var(--sidebar-text-secondary)] transition-colors hover:bg-white/5 hover:text-[var(--sidebar-text)]",
            collapsed ? "justify-center px-2" : "gap-2.5 px-2.5"
          )}
        >
          <LogOut className="h-4 w-4 shrink-0 stroke-[2]" />
          {!collapsed ? t("nav.signOut") : null}
        </button>
      </div>
    </div>
  );
}

function SidebarUserProfile({ collapsed }: { collapsed: boolean }) {
  const t = useT();
  const { user, loading } = useCurrentUser();
  const { role } = useTenantRole();

  const displayName = user?.name || user?.email;

  return (
    <div className={cn("shrink-0 border-t border-[var(--sidebar-border)] py-3", collapsed ? "px-2" : "px-3")}>
      <div
        className={cn(
          "flex items-center rounded-xl bg-sidebar-elevated/80 ring-1 ring-white/5",
          collapsed ? "justify-center px-2 py-2" : "gap-2.5 px-2.5 py-2"
        )}
        title={collapsed && displayName ? displayName : undefined}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-primary/15 text-xs font-bold text-brand-primary ring-2 ring-brand-primary/20">
          {loading ? (
            <User className="h-3.5 w-3.5 text-[var(--sidebar-text-muted)]" />
          ) : (
            (displayName?.charAt(0) ?? "?").toUpperCase()
          )}
        </div>
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            {loading ? (
              <>
                <div className="mb-1 h-3 w-20 animate-pulse rounded bg-sidebar-muted" />
                <div className="h-2.5 w-14 animate-pulse rounded bg-sidebar-muted" />
              </>
            ) : displayName ? (
              <>
                <p className="truncate text-xs font-semibold text-[var(--sidebar-text)]">
                  {displayName}
                </p>
                <p className="truncate text-[11px] text-[var(--sidebar-text-muted)]">
                  {user?.email && user.email !== displayName
                    ? user.email
                    : roleLabel(role, t)}
                </p>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SidebarBrand({
  displayName,
  logoUrl,
  assumed,
  collapsed,
  onExitAssumed,
  onClose,
  onToggleCollapsed,
}: {
  displayName: string;
  logoUrl?: string;
  assumed: boolean;
  collapsed: boolean;
  onExitAssumed: () => void;
  onClose: () => void;
  onToggleCollapsed?: () => void;
}) {
  const t = useT();

  if (collapsed) {
    return (
      <div className="shrink-0 px-2 pt-3">
        <div className="flex flex-col items-center gap-2">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg",
              logoUrl ? "bg-white p-1" : "bg-brand-primary"
            )}
            title={displayName}
          >
            {logoUrl ? (
              <img src={logoUrl} alt="" className="max-h-full max-w-full object-contain" />
            ) : (
              <BotMessageSquare className="h-4 w-4 text-[var(--sidebar-icon-active)]" />
            )}
          </div>
          {onToggleCollapsed ? (
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="hidden rounded-lg p-1.5 text-[var(--sidebar-text-muted)] transition-colors hover:bg-white/5 hover:text-[var(--sidebar-text)] lg:inline-flex"
              aria-label={t("nav.expandSidebar")}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--sidebar-text-muted)] transition-colors hover:bg-white/5 hover:text-[var(--sidebar-text)] lg:hidden"
            aria-label={t("nav.closeMenu")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="shrink-0 px-3 pt-3">
      <div className="relative overflow-hidden rounded-xl border border-[var(--sidebar-border)] bg-sidebar-elevated/70 px-3 py-3 ring-1 ring-white/5">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-primary/60 to-transparent" />
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg",
              logoUrl ? "bg-white p-1" : "bg-brand-primary"
            )}
          >
            {logoUrl ? (
              <img src={logoUrl} alt="" className="max-h-full max-w-full object-contain" />
            ) : (
              <BotMessageSquare className="h-4 w-4 text-[var(--sidebar-icon-active)]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[var(--sidebar-text)]">
              {displayName}
            </p>
            {assumed ? (
              <button
                type="button"
                onClick={onExitAssumed}
                className="mt-1.5 inline-flex items-center rounded-md bg-sidebar-muted px-2 py-0.5 text-[10px] font-medium text-[var(--sidebar-text-secondary)] transition-colors hover:text-[var(--sidebar-text)]"
              >
                {t("nav.exitSubaccount")}
              </button>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            {onToggleCollapsed ? (
              <button
                type="button"
                onClick={onToggleCollapsed}
                className="hidden rounded-lg p-1.5 text-[var(--sidebar-text-muted)] transition-colors hover:bg-white/5 hover:text-[var(--sidebar-text)] lg:inline-flex"
                aria-label={t("nav.collapseSidebar")}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-[var(--sidebar-text-muted)] transition-colors hover:bg-white/5 hover:text-[var(--sidebar-text)] lg:hidden"
              aria-label={t("nav.closeMenu")}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const t = useT();
  const { isOpen, close, isCollapsed, toggleCollapsed } = useSidebar();
  const { isAdmin, loading: adminLoading } = useAdminRole();
  const { isAdvisor, loading: roleLoading } = useTenantRole();
  const { data: branding } = useTenantBranding(!isAdmin);
  const clearContext = useClearTenantContext();
  const { data: me } = useQuery({
    queryKey: ["tenants", "me"],
    queryFn: () => api.get<Tenant>("/tenants/me"),
    enabled: !isAdmin,
  });
  const assumed = typeof window !== "undefined" ? getTenantContext() : null;
  const isReseller =
    !assumed && (me?.plan === "reseller" || me?.tenantKind === "reseller");

  const loading = adminLoading || roleLoading;
  const baseCategories = loading
    ? []
    : isAdmin
      ? adminNavCategories
      : isAdvisor
        ? advisorNavCategories
        : memberNavCategories;

  const navCategories = isReseller
    ? baseCategories.map((category) =>
        category.id === "account"
          ? {
              ...category,
              items: [
                ...category.items.slice(0, -1),
                resellerAccountItem,
                category.items[category.items.length - 1]!,
              ],
            }
          : category
      )
    : baseCategories;

  const tenantName = (branding?.brandName || me?.name || "").trim();
  const displayName = tenantName || t("common.appName");

  const shellClass =
    "sidebar-shell flex flex-col overflow-hidden border-r border-[var(--sidebar-border)] text-[var(--sidebar-text)] transition-[width] duration-200 ease-out";

  const desktopWidth = isCollapsed ? "w-[4.5rem]" : "w-60";

  const brand = (collapsed: boolean, showCollapseToggle: boolean) => (
    <SidebarBrand
      displayName={displayName}
      logoUrl={branding?.logoUrl}
      assumed={Boolean(assumed)}
      collapsed={collapsed}
      onExitAssumed={() => clearContext()}
      onClose={close}
      onToggleCollapsed={showCollapseToggle ? toggleCollapsed : undefined}
    />
  );

  return (
    <>
      <aside className={cn("sticky top-0 hidden h-screen shrink-0 lg:flex", desktopWidth, shellClass)}>
        {brand(isCollapsed, true)}
        <SidebarNav navCategories={navCategories} collapsed={isCollapsed} />
        <SidebarUserProfile collapsed={isCollapsed} />
      </aside>

      {isOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={close}
          aria-label={t("nav.closeMenu")}
        />
      ) : null}

      <aside
        className={cn(
          "sidebar-shell fixed inset-y-0 left-0 z-50 h-[100dvh] w-[17.5rem] min-h-0 transition-transform duration-200 lg:hidden",
          shellClass,
          isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        )}
      >
        {brand(false, false)}
        <SidebarNav navCategories={navCategories} collapsed={false} onNavigate={close} />
        <SidebarUserProfile collapsed={false} />
      </aside>
    </>
  );
}
