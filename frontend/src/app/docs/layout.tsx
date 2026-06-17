import Link from "next/link";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/login" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
            ChatBot Platform
          </Link>
          <nav className="flex gap-4 text-sm text-gray-600">
            <Link href="/docs/api" className="hover:text-gray-900 font-medium text-gray-900">
              API
            </Link>
            <Link href="/login" className="hover:text-gray-900">
              Login
            </Link>
            <Link href="/legal/terms" className="hover:text-gray-900">
              Terms
            </Link>
            <Link href="/legal/privacy" className="hover:text-gray-900">
              Privacy
            </Link>
          </nav>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-10">{children}</main>
    </div>
  );
}
