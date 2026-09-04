"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, User as UserIcon } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useTenantRole, type TenantRole } from "@/hooks/useTenantRole";
import { signOutUser } from "@/lib/auth-session";
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

export function UserMenuTrigger() {
  const t = useT();
  const router = useRouter();
  const { user, loading } = useCurrentUser();
  const { role } = useTenantRole();
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

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOutUser();
    } finally {
      router.push("/login");
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2.5 rounded-xl border border-default bg-surface-elevated py-1.5 pl-1.5 pr-3 shadow-sm transition-colors hover:bg-surface-muted"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-muted text-xs font-semibold text-accent ring-1 ring-default">
          {loading ? (
            <UserIcon className="h-4 w-4 text-muted" />
          ) : (
            accountInitials(displayName || "?")
          )}
        </span>
        <span className="hidden min-w-0 flex-col items-start sm:flex">
          {loading ? (
            <>
              <span className="mb-1 h-3 w-20 animate-pulse rounded bg-surface-muted" />
              <span className="h-2.5 w-14 animate-pulse rounded bg-surface-muted" />
            </>
          ) : (
            <>
              <span className="max-w-[9rem] truncate text-sm font-semibold text-primary">
                {displayName ?? t("common.appName")}
              </span>
              <span className="max-w-[9rem] truncate text-xs text-muted">
                {roleLabel(role, t)}
              </span>
            </>
          )}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180")}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-default bg-surface-elevated shadow-lg"
        >
          <div className="border-b border-subtle px-3.5 py-3">
            <p className="truncate text-sm font-semibold text-primary">
              {displayName ?? t("common.appName")}
            </p>
            {user?.email && user.email !== displayName ? (
              <p className="truncate text-xs text-muted">{user.email}</p>
            ) : null}
          </div>
          <div className="p-1.5">
            <button
              type="button"
              role="menuitem"
              disabled={signingOut}
              onClick={() => void handleSignOut()}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-secondary transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-60"
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
