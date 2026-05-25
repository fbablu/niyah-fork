"use client";

/**
 * Stripe Connect onboarding return bounce.
 *
 * Stripe's `accountLinks.create` requires an HTTPS return_url and rejects
 * custom URL schemes (niyah://). Universal Links don't fire when Stripe
 * redirects within Safari (Apple's spec — UL only on fresh user-tap
 * navigations, not in-Safari redirects), so this page is the proven
 * pattern: load HTTPS, JS-redirect to the app's custom scheme.
 */

import { useEffect, useState } from "react";

const APP_SCHEME = "niyah://stripe-return";

export default function StripeReturnPage() {
  const [showFallback, setShowFallback] = useState(false);
  const [appUrl, setAppUrl] = useState<string>(APP_SCHEME);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const intent = params.get("intent") ?? "complete";
    const target = `${APP_SCHEME}?intent=${encodeURIComponent(intent)}`;
    setAppUrl(target);
    window.location.href = target;
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
          background: "linear-gradient(135deg, #5B7CFF 0%, #3D5AFE 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 36,
          fontWeight: 700,
        }}
      >
        N
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>
        Returning to Niyah…
      </h1>
      {showFallback ? (
        <>
          <p
            style={{
              color: "rgba(255,255,255,0.65)",
              maxWidth: 320,
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            If the app didn’t open automatically, tap below.
          </p>
          <a
            href={appUrl}
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
            Open Niyah
          </a>
        </>
      ) : null}
    </main>
  );
}
