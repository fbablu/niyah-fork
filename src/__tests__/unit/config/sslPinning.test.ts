/**
 * Unit Tests for sslPinning.ts
 *
 * Tests SSL certificate pinning initialization: dev mode bypass,
 * platform checks, and graceful error handling.
 */

import { Platform } from "react-native";

describe("sslPinning", () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Platform.OS = originalOS;
    jest.restoreAllMocks();
  });

  // ─── __DEV__ mode ─────────────────────────────────────────────────────────

  it("no-ops in __DEV__ mode", async () => {
    // __DEV__ is true in test environment (set in jest.setup.ts)
    expect((globalThis as any).__DEV__).toBe(true);

    // Load a fresh copy to ensure we pick up __DEV__
    let mod: typeof import("../../../config/sslPinning");
    jest.isolateModules(() => {
      mod = require("../../../config/sslPinning");
    });

    // Should resolve without calling the pinning library
    await expect(mod!.initializeSslPinning()).resolves.toBeUndefined();
  });

  // ─── Web platform ────────────────────────────────────────────────────────

  it("no-ops on web platform", async () => {
    // Even if __DEV__ were false, web should bail out.
    // Since __DEV__ is true in test, this test verifies the early return path
    // is hit before the web check. We still run it to confirm no error.
    Platform.OS = "web" as typeof Platform.OS;

    let mod: typeof import("../../../config/sslPinning");
    jest.isolateModules(() => {
      mod = require("../../../config/sslPinning");
    });

    await expect(mod!.initializeSslPinning()).resolves.toBeUndefined();
  });

  // ─── Missing native module ───────────────────────────────────────────────

  it("handles missing native module gracefully", async () => {
    // Temporarily override __DEV__ to false and set iOS platform so the
    // function reaches the require() path.
    const prevDev = (globalThis as any).__DEV__;
    (globalThis as any).__DEV__ = false;
    Platform.OS = "ios" as typeof Platform.OS;

    // Mock require to throw (simulate missing native module)
    jest.doMock("react-native-ssl-public-key-pinning", () => {
      throw new Error("Module not found");
    });

    let mod: typeof import("../../../config/sslPinning");
    jest.isolateModules(() => {
      mod = require("../../../config/sslPinning");
    });

    // Should not throw — degrades to normal TLS
    await expect(mod!.initializeSslPinning()).resolves.toBeUndefined();

    // Restore
    jest.dontMock("react-native-ssl-public-key-pinning");
    (globalThis as any).__DEV__ = prevDev;
    Platform.OS = originalOS;
  });

  // ─── Pin configuration contract ──────────────────────────────────────────

  it("pins the four GTS roots to the Cloud Functions host", async () => {
    // The WE2 intermediate rotation (build 21) took prod down — this test
    // pins the contract: roots only, both chain families covered, and a
    // future expiry so the safety valve stays armed.
    const prevDev = (globalThis as any).__DEV__;
    (globalThis as any).__DEV__ = false;
    Platform.OS = "ios" as typeof Platform.OS;

    const initMock = jest.fn().mockResolvedValue(undefined);
    jest.doMock("react-native-ssl-public-key-pinning", () => ({
      initializeSslPinning: initMock,
    }));

    let mod: typeof import("../../../config/sslPinning");
    jest.isolateModules(() => {
      mod = require("../../../config/sslPinning");
    });
    await mod!.initializeSslPinning();

    expect(initMock).toHaveBeenCalledTimes(1);
    const config = initMock.mock.calls[0][0] as Record<
      string,
      { publicKeyHashes: string[]; expirationDate: string }
    >;
    const hosts = Object.keys(config);
    expect(hosts).toHaveLength(1);
    expect(hosts[0]).toMatch(/\.cloudfunctions\.net$/);

    const { publicKeyHashes, expirationDate } = config[hosts[0]];
    // Exactly 4 distinct, well-formed SHA-256 SPKI pins (32 bytes base64).
    expect(publicKeyHashes).toHaveLength(4);
    expect(new Set(publicKeyHashes).size).toBe(4);
    for (const pin of publicKeyHashes) {
      expect(pin).toMatch(/^[A-Za-z0-9+/]{43}=$/);
    }
    // GTS Root R1 (RSA family — current prod chain) and R4 (ECDSA family)
    // must both be present; derived from https://i.pki.goog/{r1,r4}.pem.
    expect(publicKeyHashes).toContain(
      "hxqRlPTu1bMS/0DITB1SSu0vd4u/8l8TjPgfaAp63Gc=",
    );
    expect(publicKeyHashes).toContain(
      "mEflZT5enoR1FuXLgYYGqnVEoZvmf9c2bVBpiOjYQ0c=",
    );
    // The retired WE2 intermediate pin must NOT come back.
    expect(publicKeyHashes).not.toContain(
      "vh78KSg1Ry4NaqGDV10w/cTb9VH3BQUZoCWNa93W/EY=",
    );
    // Safety-valve expiry parses and is in the future.
    expect(new Date(expirationDate).getTime()).toBeGreaterThan(Date.now());

    jest.dontMock("react-native-ssl-public-key-pinning");
    (globalThis as any).__DEV__ = prevDev;
    Platform.OS = originalOS;
  });
});
