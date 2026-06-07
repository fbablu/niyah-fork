/**
 * SSL Certificate Pinning for Cloud Functions endpoint.
 *
 * Only the Cloud Functions endpoint needs pinning because it uses JS `fetch()`.
 * Firebase Auth/Firestore and Stripe use native SDKs with their own built-in
 * certificate validation that bypasses React Native's networking layer.
 *
 * Pin hashes are derived from the server's PUBLIC key (safe to publish).
 *
 * PIN THE FULL GTS ROOT SET (R1-R4) — never leaves or intermediates. Google
 * rotates intermediates without notice (the WE2 → WR2 rotation broke every
 * prod CF call on build 21: deposits, delete-account, legal acceptance all
 * died as "Network request failed") and freely switches between the RSA
 * (R1/R2 via WR*) and ECDSA (R3/R4 via WE*) chain families per connection.
 * Pinning all four roots survives both. The GlobalSign cross-signed
 * "GTS Root R1" cert carries the same public key as the self-signed R1, so
 * the R1 pin matches it too — no separate GlobalSign pin needed.
 *
 * To re-derive the root pins from Google's authoritative repository:
 *    for r in r1 r2 r3 r4; do
 *      curl -fsS "https://i.pki.goog/${r}.pem" | openssl x509 -pubkey -noout \
 *        | openssl pkey -pubin -outform der \
 *        | openssl dgst -sha256 -binary | openssl enc -base64
 *    done
 *
 * To inspect what the server currently chains to:
 *    openssl s_client -showcerts -connect us-central1-<YOUR_PROJECT_ID>.cloudfunctions.net:443 \
 *      -servername us-central1-<YOUR_PROJECT_ID>.cloudfunctions.net 2>/dev/null \
 *      | openssl x509 -pubkey -noout \
 *      | openssl pkey -pubin -outform der \
 *      | openssl dgst -sha256 -binary \
 *      | openssl enc -base64
 *
 * After updating hashes, rebuild the dev client: pnpm build:local
 *
 * IMPORTANT: Set an expirationDate as a safety valve. If pins expire, the library
 * degrades to normal TLS rather than bricking the app.
 *
 * NOTE: expo-dev-client's network inspector conflicts with TrustKit on iOS.
 * If using expo-build-properties, set { ios: { networkInspector: false } }.
 */

import { Platform } from "react-native";

// Only initialize pinning in production builds on real devices.
// In __DEV__ mode, pinning interferes with debugging tools and proxies.
declare const __DEV__: boolean;

const FUNCTIONS_HOST = `us-central1-${process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID}.cloudfunctions.net`;

/**
 * Initialize SSL pinning for the Cloud Functions endpoint.
 * Call this once at app startup, BEFORE any fetch() calls to the endpoint.
 *
 * No-op in development builds or if the pinning library is unavailable.
 */
export async function initializeSslPinning(): Promise<void> {
  // Skip in development — pinning interferes with debugging proxies (Charles, Proxyman)
  if (__DEV__) return;

  // Skip on web (not applicable)
  if (Platform.OS === "web") return;

  try {
    const {
      initializeSslPinning: init,
    } = require("react-native-ssl-public-key-pinning");

    await init({
      [FUNCTIONS_HOST]: {
        includeSubdomains: false,
        publicKeyHashes: [
          // All four GTS roots — covers both the RSA (WR*) and ECDSA (WE*)
          // intermediate families Google rotates between. Derived from
          // https://i.pki.goog/{r1..r4}.pem on 2026-06-06 (see header).
          // GTS Root R1 (RSA family — current prod chain: leaf ← WR2 ← R1)
          "hxqRlPTu1bMS/0DITB1SSu0vd4u/8l8TjPgfaAp63Gc=",
          // GTS Root R2 (RSA family)
          "Vfd95BwDeSQo+NUYxVEEIlvkOlWY2SalKK1lPhzOx78=",
          // GTS Root R3 (ECDSA family)
          "QXnt2YHvdHR3tJYmQIr0Paosp6t/nggsEGD4QJZ3Q0g=",
          // GTS Root R4 (ECDSA family)
          "mEflZT5enoR1FuXLgYYGqnVEoZvmf9c2bVBpiOjYQ0c=",
        ],
        // Safety valve: if pins expire, degrade to normal TLS rather than
        // bricking the app. Re-verify pins against pki.goog and extend
        // before this date (GTS roots themselves are stable to 2036+).
        expirationDate: "2027-01-01",
      },
    });
  } catch {
    // Library not linked or initialization failed — degrade to normal TLS.
    // This is acceptable: pinning is defense-in-depth, not the primary security layer.
  }
}
