"use client";

import type React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  Link2,
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
  Headphones,
  Building2,
  TrendingUp,
  Star,
  Hash,
  ClipboardList,
} from "lucide-react";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useTenantRole } from "@/hooks/useTenantRole";
import { useTenantBranding } from "@/hooks/useTenantBranding";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useSidebar } from "@/components/layout/SidebarContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getTenantContext } from "@/lib/api";
import type { Tenant } from "@/types";
import {
  isSubaccountServiceEnabled,
  serviceForNavHref,
} from "@/lib/subaccount-services";
import { useClearTenantContext, useAssumeSubaccount, useResellerSubaccounts } from "@/hooks/useReseller";
import { useAuthSession } from "@/hooks/useAuthSession";
import { ThemeSwitcherCompact } from "@/components/theme/ThemeSwitcherCompact";
import { useUnreadMessages } from "@/components/notifications/UnreadMessagesProvider";

type NavItem = {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  items?: NavItem[];
};

type NavCategory = {
  id: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
};

const memberStandaloneNavItems: NavItem[] = [
  { href: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
];

const memberNavCategories: NavCategory[] = [
  {
    id: "operations",
    labelKey: "nav.categoryOperations",
    icon: LayoutGrid,
    items: [
      { href: "/bots", labelKey: "nav.bots", icon: BotMessageSquare },
      {
        href: "/voice-agents",
        labelKey: "nav.voiceAgents",
        icon: PhoneCall,
        items: [
          { href: "/voice-agents", labelKey: "voiceAgents.tab.agents", icon: Users },
          {
            href: "/voice-agents?tab=phoneNumbers",
            labelKey: "voiceAgents.tab.phoneNumbers",
            icon: Hash,
          },
        ],
      },
      { href: "/contact-center", labelKey: "nav.contactCenter", icon: Headphones },
      { href: "/conversations", labelKey: "nav.conversations", icon: MessageSquare },
      { href: "/reviews", labelKey: "nav.reviews", icon: Star },
      { href: "/supervisor", labelKey: "nav.supervisor", icon: LayoutGrid },
      { href: "/contacts", labelKey: "nav.contacts", icon: BookUser },
      { href: "/leads", labelKey: "nav.leads", icon: UserPlus },
      { href: "/sales", labelKey: "nav.sales", icon: TrendingUp },
      { href: "/advisors", labelKey: "nav.advisors", icon: Users },
    ],
  },
  {
    id: "automation",
    labelKey: "nav.categoryAutomation",
    icon: Zap,
    items: [
      { href: "/automations", labelKey: "nav.automations", icon: Zap },
      { href: "/flows", labelKey: "nav.flows", icon: GitBranch },
      { href: "/forms", labelKey: "nav.forms", icon: ClipboardList },
    ],
  },
  {
    id: "outreach",
    labelKey: "nav.categoryOutreach",
    icon: Megaphone,
    items: [
      { href: "/templates", labelKey: "nav.templates", icon: LayoutTemplate },
      { href: "/bulk-send", labelKey: "nav.bulkSend", icon: SendHorizonal },
      { href: "/campaigns", labelKey: "nav.campaigns", icon: Megaphone },
      { href: "/short-links", labelKey: "nav.shortLinks", icon: Link2 },
      { href: "/email-marketing", labelKey: "nav.emailMarketing", icon: Mail },
    ],
  },
  {
    id: "insights",
    labelKey: "nav.categoryInsights",
    icon: BarChart3,
    items: [{ href: "/metrics", labelKey: "nav.metrics", icon: BarChart3 }],
  },
  {
    id: "integrations",
    labelKey: "nav.categoryIntegrations",
    icon: KeyRound,
    items: [
      { href: "/integrations", labelKey: "nav.integrations", icon: Link2 },
      { href: "/apps", labelKey: "nav.apps", icon: LayoutGrid },
      { href: "/developer", labelKey: "nav.developer", icon: KeyRound },
    ],
  },
  {
    id: "account",
    labelKey: "nav.categoryAccount",
    icon: Settings,
    items: [
      { href: "/support", labelKey: "nav.support", icon: LifeBuoy },
      { href: "/billing", labelKey: "nav.billing", icon: CreditCard },
      { href: "/users", labelKey: "nav.userCenter", icon: Users },
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
    icon: MessageSquare,
    items: [
      { href: "/inbox", labelKey: "nav.inbox", icon: MessageSquare },
      { href: "/sales", labelKey: "nav.sales", icon: TrendingUp },
    ],
  },
];

const supervisorNavCategories: NavCategory[] = [
  {
    id: "inbox",
    labelKey: "nav.categoryMessaging",
    icon: MessageSquare,
    items: [
      { href: "/inbox", labelKey: "nav.inbox", icon: MessageSquare },
      { href: "/sales", labelKey: "nav.sales", icon: TrendingUp },
    ],
  },
  {
    id: "account",
    labelKey: "nav.categoryAccount",
    icon: Users,
    items: [{ href: "/users", labelKey: "nav.userCenter", icon: Users }],
  },
];

const adminNavCategories: NavCategory[] = [
  {
    id: "admin",
    labelKey: "nav.categoryAdmin",
    icon: Users,
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
  if (role === "supervisor") return t("nav.roleSupervisor");
  return t("nav.roleAdministrator");
}

function isNavItemActive(
  pathname: string,
  searchParams: URLSearchParams,
  href: string
): boolean {
  const [path, queryString] = href.split("?");
  if (!pathname.startsWith(path)) return false;
  if (!queryString) {
    if (path === "/voice-agents") {
      return searchParams.get("tab") !== "phoneNumbers";
    }
    return pathname === path || pathname.startsWith(`${path}/`);
  }
  const expected = new URLSearchParams(queryString);
  for (const [key, value] of expected.entries()) {
    if (searchParams.get(key) !== value) return false;
  }
  return true;
}

function navItemMatchesPath(
  item: NavItem,
  pathname: string,
  searchParams: URLSearchParams
): boolean {
  if (item.items?.length) {
    return item.items.some((child) => isNavItemActive(pathname, searchParams, child.href));
  }
  return isNavItemActive(pathname, searchParams, item.href);
}

function getActiveCategoryIds(
  pathname: string,
  searchParams: URLSearchParams,
  categories: NavCategory[]
): Set<string> {
  const active = new Set<string>();
  for (const category of categories) {
    if (category.items.some((item) => navItemMatchesPath(item, pathname, searchParams))) {
      active.add(category.id);
    }
  }
  return active;
}

function filterNavItem(item: NavItem, tenant: Tenant | undefined): NavItem | null {
  const service = serviceForNavHref(item.href);
  if (service && !isSubaccountServiceEnabled(tenant, service)) return null;
  if (item.items?.length) {
    const filteredChildren = item.items
      .map((child) => filterNavItem(child, tenant))
      .filter((child): child is NavItem => child !== null);
    if (filteredChildren.length === 0) return null;
    return { ...item, items: filteredChildren };
  }
  return item;
}

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-danger px-1.5 text-[10px] font-semibold text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function inboxBadgeCount(href: string, totalUnread: number): number {
  if (href === "/conversations" || href === "/inbox") return totalUnread;
  return 0;
}

function NavPrimaryLink({
  item,
  active,
  collapsed,
  onNavigate,
  badgeCount = 0,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
  badgeCount?: number;
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
        "flex items-center rounded-xl py-2.5 text-sm transition-all duration-150",
        collapsed ? "relative justify-center px-2" : "gap-3 px-3",
        active ? "nav-item-active" : "nav-item-idle"
      )}
    >
      <Icon className="nav-icon" />
      {!collapsed ? (
        <>
          <span className="truncate">{label}</span>
          <NavBadge count={badgeCount} />
        </>
      ) : badgeCount > 0 ? (
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-semibold text-white">
          {badgeCount > 9 ? "9+" : badgeCount}
        </span>
      ) : null}
    </Link>
  );
}

function NavSubLink({
  item,
  active,
  onNavigate,
  badgeCount = 0,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
  badgeCount?: number;
}) {
  const t = useT();
  const Icon = item.icon;
  const label = t(item.labelKey);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-label={label}
      className={cn("nav-sub-item", active && "nav-sub-item-active")}
    >
      <Icon className="nav-sub-icon" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <NavBadge count={badgeCount} />
    </Link>
  );
}

function NavItemGroupSection({
  item,
  pathname,
  searchParams,
  onNavigate,
  totalUnread,
}: {
  item: NavItem & { items: NavItem[] };
  pathname: string;
  searchParams: URLSearchParams;
  onNavigate?: () => void;
  totalUnread: number;
}) {
  const t = useT();
  const Icon = item.icon;
  const hasActiveChild = item.items.some((child) =>
    isNavItemActive(pathname, searchParams, child.href)
  );
  const [open, setOpen] = useState(hasActiveChild);

  useEffect(() => {
    if (hasActiveChild) setOpen(true);
  }, [hasActiveChild]);

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn("nav-sub-item w-full", (open || hasActiveChild) && "nav-sub-item-active")}
      >
        <Icon className="nav-sub-icon" />
        <span className="min-w-0 flex-1 truncate text-left">{t(item.labelKey)}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 opacity-50 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          open ? "max-h-48 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="nav-sub-list ml-3 space-y-0.5 border-l border-[var(--sidebar-border)] pl-2">
          {item.items.map((child) => (
            <NavSubLink
              key={child.href}
              item={child}
              active={isNavItemActive(pathname, searchParams, child.href)}
              onNavigate={onNavigate}
              badgeCount={inboxBadgeCount(child.href, totalUnread)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function renderCategoryNavItem(
  item: NavItem,
  pathname: string,
  searchParams: URLSearchParams,
  onNavigate?: () => void,
  totalUnread = 0
) {
  if (item.items?.length) {
    return (
      <NavItemGroupSection
        key={item.href}
        item={{ ...item, items: item.items }}
        pathname={pathname}
        searchParams={searchParams}
        onNavigate={onNavigate}
        totalUnread={totalUnread}
      />
    );
  }

  return (
    <NavSubLink
      key={item.href}
      item={item}
      active={isNavItemActive(pathname, searchParams, item.href)}
      onNavigate={onNavigate}
      badgeCount={inboxBadgeCount(item.href, totalUnread)}
    />
  );
}

function SidebarFlyout({
  open,
  onClose,
  anchorRef,
  children,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open) return;

    function updatePosition() {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      const panelWidth = 176;
      const maxLeft = window.innerWidth - panelWidth - 12;
      const maxTop = window.innerHeight - 48;
      setCoords({
        top: Math.max(8, Math.min(rect.top, maxTop)),
        left: Math.max(12, Math.min(rect.right + 8, maxLeft)),
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open, onClose, anchorRef]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panelRef}
      className="sidebar-flyout fixed z-[200] min-w-[11rem] py-1.5"
      style={{ top: coords.top, left: coords.left }}
    >
      {children}
    </div>,
    document.body
  );
}

function CollapsedCategoryFlyout({
  category,
  pathname,
  searchParams,
  open,
  onOpenChange,
  onNavigate,
  totalUnread,
}: {
  category: NavCategory;
  pathname: string;
  searchParams: URLSearchParams;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate?: () => void;
  totalUnread: number;
}) {
  const t = useT();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const Icon = category.icon;
  const hasActiveItem = category.items.some((item) =>
    navItemMatchesPath(item, pathname, searchParams)
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        title={t(category.labelKey)}
        aria-label={t(category.labelKey)}
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className={cn(
          "flex w-full items-center justify-center rounded-xl px-2 py-2.5 transition-all duration-150",
          open || hasActiveItem ? "nav-item-active" : "nav-item-idle"
        )}
      >
        <Icon className="nav-icon" />
      </button>
      <SidebarFlyout open={open} onClose={() => onOpenChange(false)} anchorRef={triggerRef}>
        <p className="px-3 pb-1.5 text-[11px] font-medium text-[var(--sidebar-text-muted)]">
          {t(category.labelKey)}
        </p>
        <div className="nav-sub-list mx-3 mb-1.5 max-h-[min(24rem,calc(100vh-2rem))] space-y-0.5 overflow-y-auto">
          {category.items.map((item) =>
            item.items?.length ? (
              <div key={item.href} className="space-y-0.5">
                <p className="px-3 pt-1 text-[10px] font-medium uppercase tracking-wide text-[var(--sidebar-text-muted)]">
                  {t(item.labelKey)}
                </p>
                {item.items.map((child) => (
                  <NavSubLink
                    key={child.href}
                    item={child}
                    active={isNavItemActive(pathname, searchParams, child.href)}
                    onNavigate={() => {
                      onOpenChange(false);
                      onNavigate?.();
                    }}
                    badgeCount={inboxBadgeCount(child.href, totalUnread)}
                  />
                ))}
              </div>
            ) : (
              <NavSubLink
                key={item.href}
                item={item}
                active={isNavItemActive(pathname, searchParams, item.href)}
                onNavigate={() => {
                  onOpenChange(false);
                  onNavigate?.();
                }}
                badgeCount={inboxBadgeCount(item.href, totalUnread)}
              />
            )
          )}
        </div>
      </SidebarFlyout>
    </>
  );
}

function NavCategorySection({
  category,
  isOpen,
  hasActiveItem,
  pathname,
  searchParams,
  onToggle,
  onNavigate,
  totalUnread,
}: {
  category: NavCategory;
  isOpen: boolean;
  hasActiveItem: boolean;
  pathname: string;
  searchParams: URLSearchParams;
  onToggle: () => void;
  onNavigate?: () => void;
  totalUnread: number;
}) {
  const t = useT();
  const Icon = category.icon;

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-all duration-150",
          isOpen || hasActiveItem ? "nav-item-active" : "nav-item-idle"
        )}
      >
        <Icon className="nav-icon" />
        <span className="min-w-0 flex-1 truncate">{t(category.labelKey)}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 opacity-50 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          isOpen ? "max-h-[32rem] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="nav-sub-list space-y-0.5 pb-1">
          {category.items.map((item) =>
            renderCategoryNavItem(item, pathname, searchParams, onNavigate, totalUnread)
          )}
        </div>
      </div>
    </div>
  );
}

function SidebarEdgeToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const t = useT();
  const label = collapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar");

  return (
    <button
      type="button"
      onClick={onToggle}
      title={label}
      className="sidebar-edge-toggle absolute -right-3.5 top-20 z-50 hidden h-8 w-8 items-center justify-center rounded-full lg:flex"
      aria-label={label}
    >
      {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
    </button>
  );
}

function SidebarNav({
  standaloneItems,
  navCategories,
  collapsed,
  drawerOpen,
  onNavigate,
}: {
  standaloneItems?: NavItem[];
  navCategories: NavCategory[];
  collapsed: boolean;
  drawerOpen?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useT();
  const { totalUnread } = useUnreadMessages();
  const [openCategories, setOpenCategories] = useState<Set<string>>(() =>
    getActiveCategoryIds(pathname, searchParams, navCategories)
  );
  const [openFlyoutId, setOpenFlyoutId] = useState<string | null>(null);
  const activeCategoryId = navCategories.find((category) =>
    category.items.some((item) => navItemMatchesPath(item, pathname, searchParams))
  )?.id;

  useEffect(() => {
    setOpenFlyoutId(null);
  }, [collapsed]);

  useEffect(() => {
    if (drawerOpen === false) {
      setOpenFlyoutId(null);
    }
  }, [drawerOpen]);

  useEffect(() => {
    setOpenCategories(activeCategoryId ? new Set([activeCategoryId]) : new Set());
  }, [activeCategoryId]);

  function toggleCategory(id: string) {
    setOpenCategories((prev) => {
      return prev.has(id) ? new Set() : new Set([id]);
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
          "sidebar-scroll min-h-0 flex-1 overscroll-contain py-2",
          collapsed ? "space-y-1 overflow-x-hidden overflow-y-auto px-2" : "space-y-0.5 overflow-y-auto px-3"
        )}
      >
        {standaloneItems?.length ? (
          <div className={cn("space-y-0.5", navCategories.length > 0 && "mb-2")}>
            {standaloneItems.map((item) => (
              <NavPrimaryLink
                key={item.href}
                item={item}
                active={pathname.startsWith(item.href)}
                collapsed={collapsed}
                onNavigate={onNavigate}
                badgeCount={inboxBadgeCount(item.href, totalUnread)}
              />
            ))}
          </div>
        ) : null}
        {navCategories.map((category) => {
          const isOpen = openCategories.has(category.id);
          const hasActiveItem = category.items.some((item) =>
            navItemMatchesPath(item, pathname, searchParams)
          );
          const isSingleItem = category.items.length === 1;

          if (isSingleItem) {
            const item = category.items[0]!;
            return (
              <NavPrimaryLink
                key={category.id}
                item={item}
                active={isNavItemActive(pathname, searchParams, item.href)}
                collapsed={collapsed}
                onNavigate={onNavigate}
                badgeCount={inboxBadgeCount(item.href, totalUnread)}
              />
            );
          }

          if (collapsed) {
            return (
              <CollapsedCategoryFlyout
                key={category.id}
                category={category}
                pathname={pathname}
                searchParams={searchParams}
                open={openFlyoutId === category.id}
                onOpenChange={(nextOpen) => setOpenFlyoutId(nextOpen ? category.id : null)}
                onNavigate={onNavigate}
                totalUnread={totalUnread}
              />
            );
          }

          return (
            <NavCategorySection
              key={category.id}
              category={category}
              isOpen={isOpen}
              hasActiveItem={hasActiveItem}
              pathname={pathname}
              searchParams={searchParams}
              onToggle={() => toggleCategory(category.id)}
              onNavigate={onNavigate}
              totalUnread={totalUnread}
            />
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
            "group flex w-full items-center rounded-xl py-2.5 text-[13px] font-medium text-[var(--sidebar-text-muted)] transition-colors hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text-secondary)]",
            collapsed ? "justify-center px-2" : "gap-3 px-3"
          )}
        >
          <LogOut className="nav-icon" />
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
          "flex items-center rounded-xl",
          collapsed ? "justify-center px-1 py-1" : "gap-2.5 px-1 py-1"
        )}
        title={collapsed && displayName ? displayName : undefined}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-muted text-xs font-semibold text-[var(--sidebar-text-secondary)] ring-1 ring-[var(--sidebar-border)]">
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
            <Building2 className="h-3.5 w-3.5 text-[var(--sidebar-icon)]" />
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
                <Building2 className="h-3.5 w-3.5 text-[var(--sidebar-icon)]" />
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
      <div className="shrink-0 px-2 pb-2 pt-4">
        <div className="flex flex-col items-center gap-2">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-sidebar-elevated ring-1 ring-[var(--sidebar-border)]",
              logoUrl && "bg-white p-1.5"
            )}
            title={displayName}
          >
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt=""
                width={40}
                height={40}
                unoptimized
                className="max-h-full max-w-full object-contain"
                key={logoUrl}
              />
            ) : (
              <BotMessageSquare className="h-5 w-5 text-[var(--sidebar-icon-active)]" />
            )}
          </div>
          {onToggleCollapsed ? (
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="sidebar-action-btn inline-flex rounded-lg p-1.5 lg:hidden"
              aria-label={t("nav.expandSidebar")}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="sidebar-action-btn rounded-lg p-1.5 lg:hidden"
            aria-label={t("nav.closeMenu")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-20 shrink-0 px-3 pb-2 pt-4">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-sidebar-elevated ring-1 ring-[var(--sidebar-border)]",
            logoUrl && "bg-white p-1.5"
          )}
        >
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt=""
              width={40}
              height={40}
              unoptimized
              className="max-h-full max-w-full object-contain"
              key={logoUrl}
            />
          ) : (
            <BotMessageSquare className="h-5 w-5 text-[var(--sidebar-icon-active)]" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--sidebar-text)]">{displayName}</p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {onToggleCollapsed ? (
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="sidebar-action-btn rounded-lg p-1.5 lg:hidden"
              aria-label={t("nav.collapseSidebar")}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="sidebar-action-btn rounded-lg p-1.5 lg:hidden"
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
  );
}

export function Sidebar() {
  const t = useT();
  const queryClient = useQueryClient();
  const { isAuthenticated, loading: authLoading } = useAuthSession();
  const { isOpen, close, isCollapsed, toggleCollapsed } = useSidebar();
  const { isAdmin, loading: adminLoading } = useAdminRole();
  const { isAdvisor, isSupervisor, loading: roleLoading } = useTenantRole();
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
  const [assumedId, setAssumedId] = useState<string | null>(() => getTenantContext());

  const isResellerTenant =
    me?.plan === "reseller" || me?.tenantKind === "reseller";
  const isSubaccountTenant =
    me?.tenantKind === "subaccount" || Boolean(me?.parentTenantId);
  const canManageSubaccounts =
    !isAdmin && !isAdvisor && !isSupervisor && (isResellerTenant || isSubaccountTenant);

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

    setAssumedId(stored);
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
        : isSupervisor
          ? supervisorNavCategories
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

  const filteredNavCategories = navCategories
    .map((category) => ({
      ...category,
      items: category.items
        .map((item) => filterNavItem(item, me))
        .filter((item): item is NavItem => item !== null),
    }))
    .filter((category) => category.items.length > 0);

  const standaloneItems =
    loading || isAdmin || isAdvisor || isSupervisor ? [] : memberStandaloneNavItems;

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
    "sidebar-shell relative z-40 flex flex-col border-r border-[var(--sidebar-border)] text-[var(--sidebar-text)] transition-[width] duration-200 ease-out";

  const shellContentClass = "flex min-h-0 flex-1 flex-col overflow-hidden";

  const desktopWidth = isCollapsed ? "w-[4.5rem]" : "w-72";
  const mobileWidth = isCollapsed ? "w-[4.5rem]" : "w-[min(18rem,calc(100vw-1rem))]";

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
      <aside className={cn("sticky top-0 hidden h-screen shrink-0 overflow-visible lg:flex", desktopWidth, shellClass)}>
        <SidebarEdgeToggle collapsed={isCollapsed} onToggle={toggleCollapsed} />
        <div className={shellContentClass}>
          {brand(isCollapsed, true)}
          <SidebarNav
            standaloneItems={standaloneItems}
            navCategories={filteredNavCategories}
            collapsed={isCollapsed}
          />
          <SidebarUserProfile collapsed={isCollapsed} />
        </div>
      </aside>

      {isOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-[45] bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={close}
          aria-label={t("nav.closeMenu")}
        />
      ) : null}

      <aside
        className={cn(
          shellClass,
          "fixed inset-y-0 left-0 z-50 h-[100dvh] overflow-hidden transition-[width,transform] duration-200 lg:hidden",
          mobileWidth,
          isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full pointer-events-none"
        )}
      >
        <div className={shellContentClass}>
        {brand(isCollapsed, true)}
        <SidebarNav
          standaloneItems={standaloneItems}
          navCategories={filteredNavCategories}
          collapsed={isCollapsed}
          drawerOpen={isOpen}
          onNavigate={close}
        />
        <SidebarUserProfile collapsed={isCollapsed} />
        </div>
      </aside>
    </>
  );
}
