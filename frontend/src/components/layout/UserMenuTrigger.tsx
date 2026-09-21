"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Settings, User as UserIcon } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useTenantRole, type TenantRole } from "@/hooks/useTenantRole";
import { signOutUser } from "@/lib/auth-session";
import { ThemeSwitcherMenu } from "@/components/theme/ThemeSwitcherMenu";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";

function accountInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function roleLabel(role: TenantRole, t: ReturnType<typeof useT>): string {
  if (role === "admin") return t("nav.roleAdmin");
  if (role === "advisor") return t("nav.roleAdvisor");
  if (role === "supervisor") return t("nav.roleSupervisor");
  if (role === "member") return t("nav.roleMember");
  return t("nav.roleAdministrator");
}

const menuItemClass =
  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-secondary transition-colors hover:bg-surface-muted hover:text-primary";

export function UserMenuTrigger() {
  const t = useT();
  const router = useRouter();
  const { user, loading } = useCurrentUser();
  const { role, isAdmin } = useTenantRole();
  const { data: profile } = useUserProfile(!isAdmin);
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
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

  const displayName = user?.name || user?.email;
  const profilePhotoUrl = profile?.profilePhotoUrl;

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOutUser();
    } finally {
      router.push("/login");
    }
  }

  return (
    <div ref={containerRef} className="relative ml-1">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={displayName ?? t("common.appName")}
        className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-white/15 text-[11px] font-semibold text-white ring-2 ring-white/25 transition hover:ring-white/50"
      >
        {loading ? (
          <UserIcon className="h-4 w-4 text-white/80" />
        ) : profilePhotoUrl ? (
          <Image
            src={profilePhotoUrl}
            alt=""
            width={32}
            height={32}
            unoptimized
            className="h-full w-full object-cover"
            key={profilePhotoUrl}
          />
        ) : (
          accountInitials(displayName || "?")
        )}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-default bg-surface-elevated shadow-lg"
        >
          <div className="border-b border-subtle px-3.5 py-3">
            <p className="truncate text-sm font-semibold text-primary">
              {displayName ?? t("common.appName")}
            </p>
            {user?.email && user.email !== displayName ? (
              <p className="truncate text-xs text-muted">{user.email}</p>
            ) : null}
            <p className="mt-0.5 truncate text-xs text-muted">{roleLabel(role, t)}</p>
          </div>
          <div className="p-1.5">
            {!isAdmin ? (
              <>
                <Link
                  href="/settings?tab=profile"
                  role="menuitem"
                  className={menuItemClass}
                  onClick={() => setOpen(false)}
                >
                  <UserIcon className="h-4 w-4" />
                  {t("nav.profile")}
                </Link>
                <Link
                  href="/settings?tab=general"
                  role="menuitem"
                  className={menuItemClass}
                  onClick={() => setOpen(false)}
                >
                  <Settings className="h-4 w-4" />
                  {t("nav.settings")}
                </Link>
                <div className="my-1.5 border-t border-subtle" />
              </>
            ) : null}
            <ThemeSwitcherMenu />
            <div className="my-1.5 border-t border-subtle" />
            <button
              type="button"
              role="menuitem"
              disabled={signingOut}
              onClick={() => void handleSignOut()}
              className={cn(
                menuItemClass,
                "hover:bg-danger/10 hover:text-danger disabled:opacity-60"
              )}
            >
              <LogOut className="h-4 w-4" />
              {t("nav.signOut")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
