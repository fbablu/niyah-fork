"use client";

/**
 * Friend referral landing (niyah.live/i?ref=<uid>).
 *
 * Universal Link (declared in /.well-known/apple-app-site-association for /i)
 * opens an installed app directly; otherwise this page shows the install CTA
 * and carries the referrer through the custom scheme. The app stores the ref
 * and applies the referral bonus after the new user finishes profile setup.
 *
 * Set NEXT_PUBLIC_TESTFLIGHT_URL to the External TestFlight public link.
 */

import { useEffect, useState } from "react";

const TESTFLIGHT_URL =
  process.env.NEXT_PUBLIC_TESTFLIGHT_URL ?? "https://niyah.live";

export default function ReferralPage() {
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) {
      window.location.href = `niyah://?ref=${encodeURIComponent(ref)}`;
    }
    const t = window.setTimeout(() => setShowFallback(true), 1200);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        padding: 24,
        backgroundColor: "#000",
        color: "#fff",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Rounded', 'Segoe UI', sans-serif",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 18,
          background: "linear-gradient(135deg, #2E7D5B 0%, #1F5F44 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 36,
          fontWeight: 700,
        }}
      >
        N
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
        A friend invited you to Niyah
      </h1>
      <p
        style={{
          color: "rgba(255,255,255,0.65)",
          maxWidth: 340,
          lineHeight: 1.5,
          margin: 0,
        }}
      >
        Niyah pays off your focus: stake your own money on a session, block
        distracting apps, and get your stake back when you finish.
      </p>
      <a
        href={TESTFLIGHT_URL}
        style={{
          display: "inline-block",
          padding: "14px 28px",
          borderRadius: 999,
          backgroundColor: "#fff",
          color: "#000",
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        Get Niyah
      </a>
      {showFallback ? (
        <p
          style={{
            color: "rgba(255,255,255,0.4)",
            fontSize: 13,
            maxWidth: 320,
            margin: 0,
          }}
        >
          Already have Niyah? Reopen this link to apply your invite.
        </p>
      ) : null}
    </main>
  );
}
