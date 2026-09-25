"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";

const DOC_LINKS = [
  { href: "/docs/api", labelKey: "apiDocs.navLink" as const },
  { href: "/docs/manual", labelKey: "userManual.navLink" as const },
] as const;

export function DocsNav() {
  const pathname = usePathname();
  const t = useT();

  return (
    <nav className="flex items-center gap-1 text-sm text-secondary sm:gap-2">
      {DOC_LINKS.map((link) => {
        const active = pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "rounded-lg px-3 py-1.5 transition-colors",
              active
                ? "bg-accent-muted font-medium text-accent"
                : "hover:bg-surface-muted hover:text-primary"
            )}
          >
            {t(link.labelKey)}
          </Link>
        );
      })}
      <Link
        href="/login"
        className="rounded-lg px-3 py-1.5 transition-colors hover:bg-surface-muted hover:text-primary"
      >
        Login
      </Link>
      <Link
        href="/status"
        className={cn(
          "rounded-lg px-3 py-1.5 transition-colors",
          pathname.startsWith("/status")
            ? "bg-accent-muted font-medium text-accent"
            : "hover:bg-surface-muted hover:text-primary"
        )}
      >
        Status
      </Link>
      <Link
        href="/legal/terms"
        className="hidden rounded-lg px-3 py-1.5 transition-colors hover:bg-surface-muted hover:text-primary sm:inline-flex"
      >
        Terms
      </Link>
      <Link
        href="/legal/privacy"
        className="hidden rounded-lg px-3 py-1.5 transition-colors hover:bg-surface-muted hover:text-primary sm:inline-flex"
      >
        Privacy
      </Link>
    </nav>
  );
}
