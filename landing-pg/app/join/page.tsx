"use client";

/**
 * Group focus-session invite landing (niyah.live/join?s=<sessionId>).
 *
 * If the app is installed, the Universal Link (declared in
 * /.well-known/apple-app-site-association for /join) opens Niyah directly and
 * this page never renders. Reaching here means the app is NOT installed (or the
 * UL hasn't bound yet): try the custom scheme once, then show the install CTA.
 *
 * Set NEXT_PUBLIC_TESTFLIGHT_URL to the External TestFlight public link once the
 * group exists; until then the CTA falls back to the marketing site.
 */

import { useEffect, useState } from "react";

const TESTFLIGHT_URL =
  process.env.NEXT_PUBLIC_TESTFLIGHT_URL ?? "https://niyah.live";

export default function JoinPage() {
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("s");
    if (s) {
      // Installed-but-UL-not-bound fallback: nudge the custom scheme once.
      window.location.href = `niyah://join?s=${encodeURIComponent(s)}`;
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
        You&rsquo;re invited to a focus session
      </h1>
      <p
        style={{
          color: "rgba(255,255,255,0.65)",
          maxWidth: 340,
          lineHeight: 1.5,
          margin: 0,
        }}
      >
        A friend wants to lock in together on Niyah. Stake on your own focus,
        block distracting apps, and get your stake back when you finish.
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
          Already have Niyah? Reopen this link from your invite to jump in.
        </p>
      ) : null}
    </main>
  );
}
