import Link from "next/link";

export default function StatusLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-default bg-surface-elevated">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/login" className="text-sm font-semibold text-accent hover:text-accent">
            ChatBot Platform
          </Link>
          <nav className="flex gap-4 text-sm text-secondary">
            <Link href="/docs/api" className="hover:text-primary">
              API
            </Link>
            <Link href="/status" className="text-primary hover:text-primary">
              Status
            </Link>
            <Link href="/legal/terms" className="hover:text-primary">
              Terms
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
    </div>
  );
}
