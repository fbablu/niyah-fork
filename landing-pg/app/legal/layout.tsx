import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shared chrome for the hosted legal pages (/legal/privacy, /legal/terms).
 * Uses a minimal header/footer rather than the marketing <Header/> so the
 * section-anchor nav (#features, #faq) doesn't break on a standalone page.
 */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight text-foreground"
          >
            Niyah
          </Link>
          <nav className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/legal/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/legal/terms" className="hover:text-foreground">
              Terms
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12">{children}</main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-3xl px-5 py-8 text-sm text-muted-foreground">
          © {new Date().getFullYear()} Niyah, Inc. ·{" "}
          <Link href="/" className="hover:text-foreground">
            Home
          </Link>{" "}
          ·{" "}
          <Link href="/legal/privacy" className="hover:text-foreground">
            Privacy
          </Link>{" "}
          ·{" "}
          <Link href="/legal/terms" className="hover:text-foreground">
            Terms
          </Link>
        </div>
      </footer>
    </div>
  );
}
