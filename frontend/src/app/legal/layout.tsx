import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-default bg-surface-elevated">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/login" className="text-sm font-semibold text-accent hover:text-accent">
            ChatBot Platform
          </Link>
          <nav className="flex gap-4 text-sm text-secondary">
            <Link href="/docs/api" className="hover:text-primary">
              API
            </Link>
            <Link href="/legal/terms" className="hover:text-primary">
              Terms
            </Link>
            <Link href="/legal/privacy" className="hover:text-primary">
              Privacy
            </Link>
          </nav>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-10">{children}</main>
    </div>
  );
}
