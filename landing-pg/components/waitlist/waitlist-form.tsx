"use client";

/**
 * Niyah beta-waitlist email capture (client component).
 *
 * STATIC EXPORT, NO SERVER: this POSTs the email straight to Formspree
 * (https://formspree.io) over their AJAX JSON endpoint. Formspree's free tier
 * is plenty for a Tech Week sticker drop and works from GitHub Pages with zero
 * backend. The submission lands in Formspree's dashboard + emails Fardeen.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * MANUAL SETUP (do this once, ~2 min):
 *   1. Sign in at https://formspree.io with support@niyah.live, create a new
 *      form ("Niyah Beta Waitlist"). Copy its 8-char form ID (the bit after
 *      /f/ in the endpoint, e.g. "xdkogabc").
 *   2. Paste it into FORMSPREE_ID below (or set NEXT_PUBLIC_FORMSPREE_ID in the
 *      landing-pg build env — the env var wins if both are present).
 * Until step 1 is done the form shows a friendly "not configured yet" notice
 * instead of silently dropping signups.
 * ────────────────────────────────────────────────────────────────────────────
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, CheckCircle2 } from "lucide-react";

// TODO(fardeen): paste the Formspree form ID here (or set NEXT_PUBLIC_FORMSPREE_ID).
const FORMSPREE_ID = process.env.NEXT_PUBLIC_FORMSPREE_ID || "";

type Status = "idle" | "submitting" | "success" | "error";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const configured = FORMSPREE_ID.length > 0;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!configured) return;

    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus("error");
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    setStatus("submitting");
    setErrorMsg("");

    try {
      const res = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, source: "niyah.live/waitlist" }),
      });

      if (res.ok) {
        setStatus("success");
        setEmail("");
      } else {
        setStatus("error");
        setErrorMsg("Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Network error. Please try again.");
    }
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-6 py-8 text-center">
        <CheckCircle2 className="h-10 w-10 text-primary" />
        <p className="text-lg font-semibold text-foreground">You&apos;re on the list.</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          We&apos;ll email you a TestFlight invite as spots open up. Thanks for
          backing the beta.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-3 sm:flex-row sm:items-start"
      noValidate
    >
      <div className="flex-1">
        <label htmlFor="waitlist-email" className="sr-only">
          Email address
        </label>
        <Input
          id="waitlist-email"
          type="email"
          name="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="you@email.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === "error") setStatus("idle");
          }}
          disabled={status === "submitting" || !configured}
          aria-invalid={status === "error"}
          className="h-12 rounded-full bg-card px-5 text-base"
        />
        {status === "error" && (
          <p className="mt-2 pl-2 text-sm text-destructive">{errorMsg}</p>
        )}
        {!configured && (
          <p className="mt-2 pl-2 text-sm text-muted-foreground">
            Waitlist isn&apos;t wired up yet — check back shortly, or grab Niyah
            below.
          </p>
        )}
      </div>
      <Button
        type="submit"
        size="lg"
        disabled={status === "submitting" || !configured}
        className="h-12 gap-2 rounded-full px-7 text-base font-semibold"
      >
        {status === "submitting" ? "Joining…" : "Join the beta"}
        {status !== "submitting" && <ArrowRight className="h-5 w-5" />}
      </Button>
    </form>
  );
}
