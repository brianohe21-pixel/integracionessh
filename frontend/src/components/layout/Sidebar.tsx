"use client";

import type React from "react";
import { useEffect, useState } from "react";
import Image from "next/image";
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
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useTenantRole } from "@/hooks/useTenantRole";
import { useTenantBranding } from "@/hooks/useTenantBranding";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useSidebar } from "@/components/layout/SidebarContext";

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
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const t = useT();
  const Icon = item.icon;

  return (
    <Link
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
}

function SidebarNav({
  navCategories,
  onNavigate,
}: {
  navCategories: NavCategory[];
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
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-3">
        {navCategories.map((category) => {
          const isOpen = openCategories.has(category.id);
          const hasActiveItem = category.items.some((item) => pathname.startsWith(item.href));

          return (
            <div key={category.id} className="space-y-0.5">
              <button
                type="button"
                onClick={() => toggleCategory(category.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide transition-colors",
                  hasActiveItem
                    ? "text-accent"
                    : "text-muted hover:bg-surface-muted hover:text-secondary"
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
                  "space-y-0.5 overflow-hidden transition-all duration-200",
                  isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                )}
              >
                {category.items.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    active={pathname.startsWith(item.href)}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            </div>
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
  const navCategories = loading
    ? []
    : isAdmin
      ? adminNavCategories
      : isAdvisor
        ? advisorNavCategories
        : memberNavCategories;

  const displayName = branding?.brandName ?? t("common.appName");

  const brand = (
    <div className="flex shrink-0 items-center gap-3 border-b border-default px-5 py-4">
      <div
        className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl"
        style={{ backgroundColor: "var(--brand-primary, #25D366)" }}
      >
        {branding?.logoUrl ? (
          <Image
            src={branding.logoUrl}
            alt=""
            fill
            unoptimized
            className="object-cover"
          />
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
      <SidebarNav navCategories={navCategories} />
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
        <SidebarNav navCategories={navCategories} onNavigate={close} />
        <SidebarUserProfile />
      </aside>
    </>
  );
}
