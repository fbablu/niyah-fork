/**
 * Beta-waitlist landing — served at niyah.live/waitlist (static export).
 *
 * This is the destination for the QR-code stickers handed out at NY Tech Week
 * (June 3, 2026). Scan → land here → drop an email to join the private beta, or
 * tap "Get Niyah" if they already have a TestFlight invite.
 *
 * The email capture is a styled native form that POSTs to Formspree — no server
 * needed, works from GitHub Pages. The ONE credential to fill lives in
 * components/waitlist/waitlist-form.tsx (FORMSPREE_ID). See that file's header
 * for the ~2-minute setup.
 *
 * NEXT_PUBLIC_TESTFLIGHT_URL drives the "Get Niyah" button; it falls back to
 * niyah.live until the External TestFlight public link exists.
 */

import type { Metadata } from "next";
import { WaitlistForm } from "@/components/waitlist/waitlist-form";

const TESTFLIGHT_URL =
  process.env.NEXT_PUBLIC_TESTFLIGHT_URL || "https://niyah.live";

export const metadata: Metadata = {
  title: "Join the Niyah beta",
  description:
    "Niyah is in private beta. Stake your own money on a focus session, lock your distracting apps, and earn it back when you finish. Join the waitlist for a TestFlight invite.",
};

export default function WaitlistPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-16">
      {/* Blob-forward background */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute -right-24 top-[-10%] h-[480px] w-[480px] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -left-24 bottom-[-10%] h-[420px] w-[420px] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute left-1/2 top-1/3 h-[360px] w-[360px] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="flex w-full max-w-xl flex-col items-center text-center">
        {/* Brand mark */}
        <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary text-3xl font-bold text-primary-foreground shadow-lg">
          N
        </div>

        {/* Beta pill */}
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
          <span className="h-2 w-2 rounded-full bg-primary" />
          Now in private beta
        </span>

        <h1 className="mb-5 text-4xl font-bold leading-tight tracking-tight text-foreground text-balance md:text-5xl lg:text-6xl">
          Join the Niyah beta.
        </h1>

        <p className="mb-10 max-w-md text-lg leading-relaxed text-muted-foreground md:text-xl">
          Stake your own money on a focus session, lock your distracting apps,
          and earn it back when you finish. Drop your email and we&apos;ll send a
          TestFlight invite.
        </p>

        {/* Email capture */}
        <div className="w-full max-w-lg">
          <WaitlistForm />
        </div>

        {/* Secondary CTA — for folks who already have an invite */}
        <div className="mt-12 flex flex-col items-center gap-3">
          <p className="text-sm text-muted-foreground">
            Already have a TestFlight invite?
          </p>
          <a
            href={TESTFLIGHT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-full border border-border bg-card px-6 py-3 text-base font-semibold text-foreground transition-colors hover:bg-secondary"
          >
            Get Niyah
          </a>
        </div>

        <p className="mt-14 max-w-sm text-xs leading-relaxed text-muted-foreground">
          Your stake is always your own money — never pooled or shared. Complete
          your session and it comes right back to you.
        </p>
      </div>
    </main>
  );
}
