"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
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
  LayoutDashboard,
  BarChart3,
  Settings,
  LogOut,
  Megaphone,
  Mail,
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
  Check,
  PhoneCall,
  Building2,
} from "lucide-react";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useTenantRole } from "@/hooks/useTenantRole";
import { useTenantBranding } from "@/hooks/useTenantBranding";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useSidebar } from "@/components/layout/SidebarContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getTenantContext } from "@/lib/api";
import type { Tenant } from "@/types";
import { useClearTenantContext, useAssumeSubaccount, useResellerSubaccounts } from "@/hooks/useReseller";
import { useAuthSession } from "@/hooks/useAuthSession";
import { ThemeSwitcherCompact } from "@/components/theme/ThemeSwitcherCompact";

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

const memberStandaloneNavItems: NavItem[] = [
  { href: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
];

const memberNavCategories: NavCategory[] = [
  {
    id: "operations",
    labelKey: "nav.categoryOperations",
    items: [
      { href: "/bots", labelKey: "nav.bots", icon: BotMessageSquare },
      { href: "/voice-agents", labelKey: "nav.voiceAgents", icon: PhoneCall },
      { href: "/conversations", labelKey: "nav.conversations", icon: MessageSquare },
      { href: "/supervisor", labelKey: "nav.supervisor", icon: LayoutGrid },
      { href: "/contacts", labelKey: "nav.contacts", icon: BookUser },
      { href: "/leads", labelKey: "nav.leads", icon: UserPlus },
      { href: "/advisors", labelKey: "nav.advisors", icon: Users },
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
    id: "outreach",
    labelKey: "nav.categoryOutreach",
    items: [
      { href: "/templates", labelKey: "nav.templates", icon: LayoutTemplate },
      { href: "/bulk-send", labelKey: "nav.bulkSend", icon: SendHorizonal },
      { href: "/campaigns", labelKey: "nav.campaigns", icon: Megaphone },
      { href: "/email-marketing", labelKey: "nav.emailMarketing", icon: Mail },
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
          ? "nav-item-active shadow-sm"
          : "nav-item-idle"
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 stroke-[2]",
          active ? "text-brand-primary" : "text-[var(--sidebar-icon)]"
        )}
      />
      {!collapsed ? <span className="truncate">{label}</span> : null}
    </Link>
  );
}

function SidebarNav({
  standaloneItems,
  navCategories,
  collapsed,
  onNavigate,
}: {
  standaloneItems?: NavItem[];
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
        {standaloneItems?.length ? (
          <div className={cn("space-y-0.5", navCategories.length > 0 && "mb-3")}>
            {standaloneItems.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={pathname.startsWith(item.href)}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ) : null}
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
                  (index > 0 || (standaloneItems?.length ?? 0) > 0) &&
                    "border-t border-[var(--sidebar-border)] pt-3"
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
                    : "text-[var(--sidebar-text-muted)] hover:bg-sidebar-hover hover:text-[var(--sidebar-text-secondary)]"
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
          <div className="mb-3 px-1">
            <ThemeSwitcherCompact />
          </div>
        ) : (
          <div className="mb-3 flex justify-center">
            <ThemeSwitcherCompact collapsed />
          </div>
        )}
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
            "flex w-full items-center rounded-lg py-2 text-[13px] font-medium text-[var(--sidebar-text-secondary)] transition-colors hover:bg-sidebar-hover hover:text-[var(--sidebar-text)]",
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
          "flex items-center rounded-xl bg-sidebar-elevated ring-1 ring-[var(--sidebar-border)]",
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

function accountInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function SubaccountSwitcher({
  assumedId,
  subaccounts,
  switching,
  onSelectSubaccount,
}: {
  assumedId: string | null;
  subaccounts: Tenant[];
  switching: boolean;
  onSelectSubaccount: (subaccountId: string | null) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = assumedId
    ? subaccounts.find((item) => item.tenantId === assumedId)
    : undefined;
  const label = selected?.name ?? t("nav.mainAccount");

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function choose(id: string | null) {
    setOpen(false);
    if (id === assumedId) return;
    onSelectSubaccount(id);
  }

  return (
    <div ref={rootRef} className="relative mt-3">
      <button
        type="button"
        disabled={switching}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("nav.switchSubaccount")}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "group flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-all",
          "border-[var(--sidebar-border)] bg-sidebar-muted hover:border-[color-mix(in_srgb,var(--brand-primary)_30%,var(--sidebar-border))] hover:bg-sidebar-hover",
          open && "border-brand-primary/35 bg-accent-muted",
          switching && "opacity-60"
        )}
      >
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold",
            assumedId
              ? "bg-brand-primary/20 text-brand-primary"
              : "bg-sidebar-muted text-[var(--sidebar-text-secondary)]"
          )}
        >
          {assumedId ? (
            accountInitials(label)
          ) : (
            <Building2 className="h-3.5 w-3.5" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium leading-tight text-[var(--sidebar-text)]">
            {label}
          </span>
          {assumedId ? (
            <span className="block truncate text-[10px] leading-tight text-brand-primary/90">
              {t("reseller.assumedBanner")}
            </span>
          ) : (
            <span className="block truncate text-[10px] leading-tight text-[var(--sidebar-text-muted)]">
              {t("nav.switchSubaccount")}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-[var(--sidebar-text-muted)] transition-transform duration-200",
            open && "rotate-180 text-[var(--sidebar-text)]"
          )}
        />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label={t("nav.switchSubaccount")}
          className="absolute left-0 right-0 z-50 mt-1.5 min-w-full overflow-hidden rounded-xl border border-[var(--sidebar-border)] bg-sidebar-elevated shadow-lg"
        >
          <div className="border-b border-[var(--sidebar-border)] px-2.5 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--sidebar-text-muted)]">
              {t("nav.subaccounts")}
            </p>
          </div>
          <div className="sidebar-scroll max-h-52 overflow-y-auto p-1">
            <button
              type="button"
              role="option"
              aria-selected={!assumedId}
              onClick={() => choose(null)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors",
                !assumedId
                  ? "bg-accent-muted text-[var(--sidebar-text)]"
                  : "text-[var(--sidebar-text-secondary)] hover:bg-sidebar-hover hover:text-[var(--sidebar-text)]"
              )}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-sidebar-muted">
                <Building2 className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1 truncate text-xs font-medium">
                {t("nav.mainAccount")}
              </span>
              {!assumedId ? <Check className="h-3.5 w-3.5 shrink-0 text-brand-primary" /> : null}
            </button>

            {subaccounts.length > 0 ? (
              <div className="my-1 border-t border-[var(--sidebar-border)]" />
            ) : null}

            {subaccounts.map((item) => {
              const active = item.tenantId === assumedId;
              const suspended = item.status === "suspended";
              return (
                <button
                  key={item.tenantId}
                  type="button"
                  role="option"
                  aria-selected={active}
                  disabled={suspended || switching}
                  onClick={() => choose(item.tenantId)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors",
                    active
                      ? "bg-accent-muted text-[var(--sidebar-text)]"
                      : "text-[var(--sidebar-text-secondary)] hover:bg-sidebar-hover hover:text-[var(--sidebar-text)]",
                    suspended && "cursor-not-allowed opacity-45"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold",
                      active ? "bg-brand-primary/25 text-brand-primary" : "bg-sidebar-muted"
                    )}
                  >
                    {accountInitials(item.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">{item.name}</span>
                    {suspended ? (
                      <span className="block text-[10px] text-[var(--sidebar-text-muted)]">
                        {t("common.suspended")}
                      </span>
                    ) : null}
                  </span>
                  {active ? <Check className="h-3.5 w-3.5 shrink-0 text-brand-primary" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SidebarBrand({
  displayName,
  logoUrl,
  assumedId,
  subaccounts,
  switching,
  collapsed,
  onSelectSubaccount,
  onClose,
  onToggleCollapsed,
}: {
  displayName: string;
  logoUrl?: string;
  assumedId: string | null;
  subaccounts: Tenant[];
  switching: boolean;
  collapsed: boolean;
  onSelectSubaccount: (subaccountId: string | null) => void;
  onClose: () => void;
  onToggleCollapsed?: () => void;
}) {
  const t = useT();
  const showSwitcher = subaccounts.length > 0 || Boolean(assumedId);

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
              <img src={logoUrl} alt="" className="max-h-full max-w-full object-contain" key={logoUrl} />
            ) : (
              <BotMessageSquare className="h-4 w-4 text-white" />
            )}
          </div>
          {onToggleCollapsed ? (
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="inline-flex rounded-lg p-1.5 text-[var(--sidebar-text-muted)] transition-colors hover:bg-sidebar-hover hover:text-[var(--sidebar-text)]"
              aria-label={t("nav.expandSidebar")}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--sidebar-text-muted)] transition-colors hover:bg-sidebar-hover hover:text-[var(--sidebar-text)] lg:hidden"
            aria-label={t("nav.closeMenu")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-20 shrink-0 px-3 pt-3">
      <div className="relative rounded-xl border border-[var(--sidebar-border)] bg-sidebar-elevated px-3 py-3">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-primary/40 to-transparent" />
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg",
              logoUrl ? "bg-white p-1" : "bg-brand-primary"
            )}
          >
            {logoUrl ? (
              <img src={logoUrl} alt="" className="max-h-full max-w-full object-contain" key={logoUrl} />
            ) : (
              <BotMessageSquare className="h-4 w-4 text-white" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-snug text-[var(--sidebar-text)] break-words">
              {displayName}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            {onToggleCollapsed ? (
              <button
                type="button"
                onClick={onToggleCollapsed}
                className="inline-flex rounded-lg p-1.5 text-[var(--sidebar-text-muted)] transition-colors hover:bg-sidebar-hover hover:text-[var(--sidebar-text)]"
                aria-label={t("nav.collapseSidebar")}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-[var(--sidebar-text-muted)] transition-colors hover:bg-sidebar-hover hover:text-[var(--sidebar-text)] lg:hidden"
              aria-label={t("nav.closeMenu")}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        {showSwitcher ? (
          <SubaccountSwitcher
            assumedId={assumedId}
            subaccounts={subaccounts}
            switching={switching}
            onSelectSubaccount={onSelectSubaccount}
          />
        ) : null}
      </div>
    </div>
  );
}

export function Sidebar() {
  const t = useT();
  const queryClient = useQueryClient();
  const { isAuthenticated, loading: authLoading } = useAuthSession();
  const { isOpen, close, isCollapsed, toggleCollapsed } = useSidebar();
  const { isAdmin, loading: adminLoading } = useAdminRole();
  const { isAdvisor, loading: roleLoading } = useTenantRole();
  const brandingEnabled =
    isAuthenticated && !authLoading && !adminLoading && !isAdmin;
  const { data: branding } = useTenantBranding(brandingEnabled);
  const clearContext = useClearTenantContext();
  const assume = useAssumeSubaccount();
  const { data: me } = useQuery({
    queryKey: ["tenants", "me"],
    queryFn: () => api.get<Tenant>("/tenants/me"),
    enabled: isAuthenticated && !authLoading && !isAdmin,
  });
  const [assumedId, setAssumedId] = useState<string | null>(null);

  const isResellerTenant =
    me?.plan === "reseller" || me?.tenantKind === "reseller";
  const isSubaccountTenant =
    me?.tenantKind === "subaccount" || Boolean(me?.parentTenantId);
  const canManageSubaccounts =
    !isAdmin && !isAdvisor && (isResellerTenant || isSubaccountTenant);

  useEffect(() => {
    const stored = getTenantContext();

    if (!me) {
      setAssumedId(stored);
      return;
    }

    if (!isResellerTenant && !isSubaccountTenant) {
      if (stored) clearContext();
      queryClient.removeQueries({ queryKey: ["reseller-subaccounts"] });
      setAssumedId(null);
      return;
    }

    if (stored && isResellerTenant && !isSubaccountTenant) {
      clearContext();
      setAssumedId(null);
      return;
    }

    setAssumedId(stored && isSubaccountTenant ? stored : null);
  }, [me, isResellerTenant, isSubaccountTenant, clearContext, queryClient]);

  const isResellerHome = canManageSubaccounts && !assumedId && isResellerTenant;
  const { data: subaccountsData } = useResellerSubaccounts(canManageSubaccounts);
  const subaccounts = canManageSubaccounts
    ? (subaccountsData?.items ?? []).filter(
        (item) => item.status !== "suspended" || item.tenantId === assumedId
      )
    : [];

  const loading = adminLoading || roleLoading;
  const baseCategories = loading
    ? []
    : isAdmin
      ? adminNavCategories
      : isAdvisor
        ? advisorNavCategories
        : memberNavCategories;

  const navCategories = isResellerHome
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

  const standaloneItems =
    loading || isAdmin || isAdvisor ? [] : memberStandaloneNavItems;

  const assumedSubaccount = assumedId
    ? subaccounts.find((item) => item.tenantId === assumedId)
    : undefined;
  const tenantName = (
    assumedSubaccount?.name ||
    branding?.brandName ||
    me?.resolvedBranding?.brandName ||
    me?.branding?.brandName ||
    ""
  ).trim();
  const displayName = tenantName || me?.name?.trim() || t("common.appName");
  const logoUrl = branding?.logoUrl ?? me?.resolvedBranding?.logoUrl;

  async function handleSelectSubaccount(subaccountId: string | null) {
    if (subaccountId === assumedId) return;
    if (!subaccountId) {
      clearContext();
      setAssumedId(null);
      return;
    }
    await assume.mutateAsync(subaccountId);
    setAssumedId(subaccountId);
  }

  const shellClass =
    "sidebar-shell flex flex-col overflow-hidden border-r border-[var(--sidebar-border)] text-[var(--sidebar-text)] transition-[width] duration-200 ease-out";

  const desktopWidth = isCollapsed ? "w-[4.5rem]" : "w-72";

  const brand = (collapsed: boolean, showCollapseToggle: boolean) => (
    <SidebarBrand
      displayName={displayName}
      logoUrl={logoUrl}
      assumedId={canManageSubaccounts ? assumedId : null}
      subaccounts={subaccounts}
      switching={assume.isPending}
      collapsed={collapsed}
      onSelectSubaccount={(id) => void handleSelectSubaccount(id)}
      onClose={close}
      onToggleCollapsed={showCollapseToggle ? toggleCollapsed : undefined}
    />
  );

  return (
    <>
      <aside className={cn("sticky top-0 hidden h-screen shrink-0 lg:flex", desktopWidth, shellClass)}>
        {brand(isCollapsed, true)}
        <SidebarNav
          standaloneItems={standaloneItems}
          navCategories={navCategories}
          collapsed={isCollapsed}
        />
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
          "sidebar-shell fixed inset-y-0 left-0 z-50 h-[100dvh] min-h-0 transition-[width,transform] duration-200 lg:hidden",
          isCollapsed ? "w-[4.5rem]" : "w-72",
          shellClass,
          isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        )}
      >
        {brand(isCollapsed, true)}
        <SidebarNav
          standaloneItems={standaloneItems}
          navCategories={navCategories}
          collapsed={isCollapsed}
          onNavigate={close}
        />
        <SidebarUserProfile collapsed={isCollapsed} />
      </aside>
    </>
  );
}
