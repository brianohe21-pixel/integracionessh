import Link from "next/link";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,var(--glow-accent),transparent_42%),var(--surface)]">
      <header className="sticky top-0 z-30 border-b border-default/80 bg-surface-elevated/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3.5">
          <Link
            href="/login"
            className="text-sm font-semibold tracking-tight text-accent transition-colors hover:text-accent-hover"
          >
            ChatBot Platform
          </Link>
          <nav className="flex items-center gap-1 text-sm text-secondary sm:gap-2">
            <Link
              href="/docs/api"
              className="rounded-lg bg-accent-muted px-3 py-1.5 font-medium text-accent"
            >
              API
            </Link>
            <Link
              href="/login"
              className="rounded-lg px-3 py-1.5 transition-colors hover:bg-surface-muted hover:text-primary"
            >
              Login
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
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8 sm:py-12">{children}</main>
    </div>
  );
}
