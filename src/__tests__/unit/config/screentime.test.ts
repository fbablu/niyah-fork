/**
 * Unit Tests for screentime.ts
 *
 * Tests Screen Time API wrapper: availability checks, authorization,
 * app selection, blocking, and event listeners.
 *
 * The native module (NiyahScreenTime) is mocked here since it is not
 * covered by jest.setup.ts. Because isScreenTimeAvailable is a module-level
 * constant evaluated at import time, we use jest.isolateModules + jest.doMock
 * to control Platform.OS and Platform.Version before the module loads.
 */

import type { AppSelectionToken } from "../../../../modules/niyah-screentime";

// Default token returned by the selection mocks (real native type is a token
// object, not a string — keep the mock type-accurate).
const DEFAULT_TOKEN: AppSelectionToken = {
  id: "sel-default",
  appCount: 5,
  categoryCount: 0,
  label: "5 apps, 0 categories",
};

// Shared mock for the native module — kept outside isolateModules so we can
// inspect calls from any test.
const mockNativeModule = {
  requestAuthorization: jest.fn(() => Promise.resolve("authorized")),
  getAuthorizationStatus: jest.fn(() => "authorized"),
  presentAppPicker: jest.fn(
    (): Promise<AppSelectionToken> => Promise.resolve(DEFAULT_TOKEN),
  ),
  getSavedSelection: jest.fn((): AppSelectionToken | null => DEFAULT_TOKEN),
  clearSelection: jest.fn(() => Promise.resolve()),
  startBlocking: jest.fn(() => Promise.resolve()),
  stopBlocking: jest.fn(() => Promise.resolve()),
  isBlocking: jest.fn(() => false),
  addListener: jest.fn((_event: string, _callback: any) => ({
    remove: jest.fn(),
  })),
};

function resetNativeMocks() {
  mockNativeModule.requestAuthorization
    .mockClear()
    .mockImplementation(() => Promise.resolve("authorized"));
  mockNativeModule.getAuthorizationStatus
    .mockClear()
    .mockReturnValue("authorized");
  mockNativeModule.presentAppPicker
    .mockClear()
    .mockImplementation(() => Promise.resolve(DEFAULT_TOKEN));
  mockNativeModule.getSavedSelection.mockClear().mockReturnValue(DEFAULT_TOKEN);
  mockNativeModule.clearSelection
    .mockClear()
    .mockImplementation(() => Promise.resolve());
  mockNativeModule.startBlocking
    .mockClear()
    .mockImplementation(() => Promise.resolve());
  mockNativeModule.stopBlocking
    .mockClear()
    .mockImplementation(() => Promise.resolve());
  mockNativeModule.isBlocking.mockClear().mockReturnValue(false);
  mockNativeModule.addListener
    .mockClear()
    .mockImplementation((_event: string, _callback: any) => ({
      remove: jest.fn(),
    }));
}

// Controllable Platform values
let mockPlatformOS = "ios";
let mockPlatformVersion: string | number = "16";

// Top-level mock for react-native — jest.mock is hoisted.
// Uses a getter so the live values of mockPlatformOS / mockPlatformVersion are
// read at the time screentime.ts evaluates isScreenTimeAvailable.
jest.mock("react-native", () => {
  const actual = jest.requireActual("react-native");
  return {
    __esModule: true,
    // Re-export everything except Platform via a Proxy so we don't eagerly
    // spread react-native (which triggers lazy native-module getters).
    ...Object.fromEntries(
      ["StyleSheet", "Alert", "Dimensions", "PixelRatio", "AppState"].map(
        (k) => [k, (actual as any)[k]],
      ),
    ),
    Platform: new Proxy(actual.Platform, {
      get(_target: any, prop: string) {
        if (prop === "OS") return mockPlatformOS;
        if (prop === "Version") return mockPlatformVersion;
        return (actual.Platform as any)[prop];
      },
    }),
  };
});

jest.mock("../../../../modules/niyah-screentime", () => ({
  NiyahScreenTime: mockNativeModule,
}));

/**
 * Load screentime module with fresh module cache so isScreenTimeAvailable
 * re-evaluates using the current mockPlatformOS / mockPlatformVersion.
 */
function loadScreenTimeModule() {
  let mod: typeof import("../../../config/screentime");
  jest.isolateModules(() => {
    mod = require("../../../config/screentime");
  });
  return mod!;
}

describe("screentime", () => {
  beforeEach(() => {
    resetNativeMocks();
  });

  // ─── Unavailable (non-iOS or old version) ─────────────────────────────────

  describe("when Screen Time is unavailable", () => {
    describe("on Android", () => {
      let st: ReturnType<typeof loadScreenTimeModule>;

      beforeEach(() => {
        mockPlatformOS = "android";
        mockPlatformVersion = 33;
        st = loadScreenTimeModule();
      });

      it("isScreenTimeAvailable is false", () => {
        expect(st.isScreenTimeAvailable).toBe(false);
      });

      it("requestScreenTimeAuth returns 'denied'", async () => {
        const result = await st.requestScreenTimeAuth();
        expect(result).toBe("denied");
        expect(mockNativeModule.requestAuthorization).not.toHaveBeenCalled();
      });

      it("getScreenTimeAuthStatus returns 'denied'", () => {
        expect(st.getScreenTimeAuthStatus()).toBe("denied");
        expect(mockNativeModule.getAuthorizationStatus).not.toHaveBeenCalled();
      });

      it("isBlocking returns false", () => {
        expect(st.isBlocking()).toBe(false);
        expect(mockNativeModule.isBlocking).not.toHaveBeenCalled();
      });

      it("getSavedAppSelection returns null", () => {
        expect(st.getSavedAppSelection()).toBeNull();
        expect(mockNativeModule.getSavedSelection).not.toHaveBeenCalled();
      });

      it("presentAppPicker throws", async () => {
        await expect(st.presentAppPicker()).rejects.toThrow(
          "Screen Time API is not available on this device",
        );
      });

      it("startBlocking resolves without calling native", async () => {
        await st.startBlocking();
        expect(mockNativeModule.startBlocking).not.toHaveBeenCalled();
      });

      it("stopBlocking resolves without calling native", async () => {
        await st.stopBlocking();
        expect(mockNativeModule.stopBlocking).not.toHaveBeenCalled();
      });

      it("clearAppSelection resolves without calling native", async () => {
        await st.clearAppSelection();
        expect(mockNativeModule.clearSelection).not.toHaveBeenCalled();
      });

      it("onShieldViolation returns noop unsubscribe", () => {
        const callback = jest.fn();
        const unsub = st.onShieldViolation(callback);
        expect(mockNativeModule.addListener).not.toHaveBeenCalled();
        expect(typeof unsub).toBe("function");
        unsub();
      });

      it("onAuthorizationChange returns noop unsubscribe", () => {
        const callback = jest.fn();
        const unsub = st.onAuthorizationChange(callback);
        expect(mockNativeModule.addListener).not.toHaveBeenCalled();
        unsub();
      });

      it("onSurrenderRequested returns noop unsubscribe", () => {
        const callback = jest.fn();
        const unsub = st.onSurrenderRequested(callback);
        expect(mockNativeModule.addListener).not.toHaveBeenCalled();
        unsub();
      });
    });

    describe("on iOS < 16", () => {
      let st: ReturnType<typeof loadScreenTimeModule>;

      beforeEach(() => {
        mockPlatformOS = "ios";
        mockPlatformVersion = "15.7";
        st = loadScreenTimeModule();
      });

      it("isScreenTimeAvailable is false", () => {
        expect(st.isScreenTimeAvailable).toBe(false);
      });

      it("requestScreenTimeAuth returns 'denied'", async () => {
        expect(await st.requestScreenTimeAuth()).toBe("denied");
      });
    });
  });

  // ─── Available (iOS 16+) ──────────────────────────────────────────────────

  describe("when Screen Time is available", () => {
    let st: ReturnType<typeof loadScreenTimeModule>;

    beforeEach(() => {
      mockPlatformOS = "ios";
      mockPlatformVersion = "16";
      st = loadScreenTimeModule();
    });

    it("isScreenTimeAvailable is true", () => {
      expect(st.isScreenTimeAvailable).toBe(true);
    });

    // Authorization

    it("requestScreenTimeAuth delegates to NiyahScreenTime", async () => {
      const result = await st.requestScreenTimeAuth();
      expect(mockNativeModule.requestAuthorization).toHaveBeenCalled();
      expect(result).toBe("authorized");
    });

    it("getScreenTimeAuthStatus delegates to NiyahScreenTime", () => {
      const result = st.getScreenTimeAuthStatus();
      expect(mockNativeModule.getAuthorizationStatus).toHaveBeenCalled();
      expect(result).toBe("authorized");
    });

    // App selection

    it("presentAppPicker delegates to NiyahScreenTime", async () => {
      const result = await st.presentAppPicker();
      expect(mockNativeModule.presentAppPicker).toHaveBeenCalled();
      expect(result).toEqual(DEFAULT_TOKEN);
    });

    it("getSavedAppSelection delegates to NiyahScreenTime", () => {
      const result = st.getSavedAppSelection();
      expect(mockNativeModule.getSavedSelection).toHaveBeenCalled();
      expect(result).toEqual(DEFAULT_TOKEN);
    });

    it("clearAppSelection delegates to NiyahScreenTime", async () => {
      await st.clearAppSelection();
      expect(mockNativeModule.clearSelection).toHaveBeenCalled();
    });

    // Blocking

    it("startBlocking delegates to NiyahScreenTime", async () => {
      await st.startBlocking();
      expect(mockNativeModule.startBlocking).toHaveBeenCalled();
    });

    it("stopBlocking delegates to NiyahScreenTime", async () => {
      await st.stopBlocking();
      expect(mockNativeModule.stopBlocking).toHaveBeenCalled();
    });

    it("isBlocking delegates to NiyahScreenTime", () => {
      mockNativeModule.isBlocking.mockReturnValue(true);
      expect(st.isBlocking()).toBe(true);
      expect(mockNativeModule.isBlocking).toHaveBeenCalled();
    });

    // Event listeners

    it("onShieldViolation subscribes and returns unsubscribe", () => {
      const mockRemove = jest.fn();
      mockNativeModule.addListener.mockReturnValue({ remove: mockRemove });

      const callback = jest.fn();
      const unsub = st.onShieldViolation(callback);

      expect(mockNativeModule.addListener).toHaveBeenCalledWith(
        "onShieldViolation",
        callback,
      );

      unsub();
      expect(mockRemove).toHaveBeenCalled();
    });

    it("onAuthorizationChange subscribes and wraps callback", () => {
      const mockRemove = jest.fn();
      mockNativeModule.addListener.mockReturnValue({ remove: mockRemove });

      const callback = jest.fn();
      const unsub = st.onAuthorizationChange(callback);

      expect(mockNativeModule.addListener).toHaveBeenCalledWith(
        "onAuthorizationChange",
        expect.any(Function),
      );

      // The wrapper should extract event.status before calling the callback
      const wrappedCb = mockNativeModule.addListener.mock.calls[0][1];
      wrappedCb({ status: "approved" });
      expect(callback).toHaveBeenCalledWith("approved");

      unsub();
      expect(mockRemove).toHaveBeenCalled();
    });

    it("onSurrenderRequested subscribes and returns unsubscribe", () => {
      const mockRemove = jest.fn();
      mockNativeModule.addListener.mockReturnValue({ remove: mockRemove });

      const callback = jest.fn();
      const unsub = st.onSurrenderRequested(callback);

      expect(mockNativeModule.addListener).toHaveBeenCalledWith(
        "onSurrenderRequested",
        callback,
      );

      unsub();
      expect(mockRemove).toHaveBeenCalled();
    });
  });

  // ─── App-selection gate (Phase 1: never start a session unshielded) ───────

  const token = (appCount: number, categoryCount: number) => ({
    id: "sel-1",
    appCount,
    categoryCount,
    label: `${appCount} apps, ${categoryCount} categories`,
  });

  describe("app-selection gate — unavailable device", () => {
    let st: ReturnType<typeof loadScreenTimeModule>;
    beforeEach(() => {
      mockPlatformOS = "android";
      mockPlatformVersion = 33;
      st = loadScreenTimeModule();
    });

    it("getAppSelectionStatus reports available:false but does not trap the user", () => {
      const s = st.getAppSelectionStatus();
      expect(s).toEqual({
        available: false,
        authorized: true,
        hasApps: true,
        selection: null,
      });
    });

    it("validateAndPromptForAppSelection resolves ok (blocking can't apply here)", async () => {
      const r = await st.validateAndPromptForAppSelection();
      expect(r.ok).toBe(true);
      expect(r).toMatchObject({ reason: "unavailable" });
      expect(mockNativeModule.presentAppPicker).not.toHaveBeenCalled();
    });
  });

  describe("app-selection gate — available device", () => {
    let st: ReturnType<typeof loadScreenTimeModule>;
    beforeEach(() => {
      mockPlatformOS = "ios";
      mockPlatformVersion = "16";
      st = loadScreenTimeModule();
    });

    it("ready when authorized with a non-empty app selection", () => {
      mockNativeModule.getAuthorizationStatus.mockReturnValue("approved");
      mockNativeModule.getSavedSelection.mockReturnValue(token(5, 0));
      expect(st.getAppSelectionStatus()).toMatchObject({
        available: true,
        authorized: true,
        hasApps: true,
      });
    });

    it("counts a category-only selection as non-empty (appCount 0, categoryCount 2)", () => {
      mockNativeModule.getAuthorizationStatus.mockReturnValue("approved");
      mockNativeModule.getSavedSelection.mockReturnValue(token(0, 2));
      expect(st.getAppSelectionStatus().hasApps).toBe(true);
    });

    it("hasApps:false when the selection names no apps and no categories", () => {
      mockNativeModule.getAuthorizationStatus.mockReturnValue("approved");
      mockNativeModule.getSavedSelection.mockReturnValue(token(0, 0));
      expect(st.getAppSelectionStatus().hasApps).toBe(false);
    });

    it("authorized:false when Screen Time auth is not 'approved'", () => {
      mockNativeModule.getAuthorizationStatus.mockReturnValue("denied");
      mockNativeModule.getSavedSelection.mockReturnValue(token(5, 0));
      expect(st.getAppSelectionStatus().authorized).toBe(false);
    });

    it("gate ok without prompting when already authorized + selected", async () => {
      mockNativeModule.getAuthorizationStatus.mockReturnValue("approved");
      mockNativeModule.getSavedSelection.mockReturnValue(token(3, 0));
      const r = await st.validateAndPromptForAppSelection();
      expect(r).toMatchObject({ ok: true, reason: "ready" });
      expect(mockNativeModule.requestAuthorization).not.toHaveBeenCalled();
      expect(mockNativeModule.presentAppPicker).not.toHaveBeenCalled();
    });

    it("gate returns needs-auth when auth is declined", async () => {
      mockNativeModule.getAuthorizationStatus.mockReturnValue("notDetermined");
      mockNativeModule.requestAuthorization.mockResolvedValue("denied");
      const r = await st.validateAndPromptForAppSelection();
      expect(r).toEqual({ ok: false, reason: "needs-auth" });
      expect(mockNativeModule.presentAppPicker).not.toHaveBeenCalled();
    });

    it("gate prompts the picker when selection is empty, then succeeds", async () => {
      mockNativeModule.getAuthorizationStatus.mockReturnValue("approved");
      mockNativeModule.getSavedSelection.mockReturnValue(null);
      mockNativeModule.presentAppPicker.mockResolvedValue(token(4, 1));
      const r = await st.validateAndPromptForAppSelection();
      expect(mockNativeModule.presentAppPicker).toHaveBeenCalled();
      expect(r).toMatchObject({ ok: true, reason: "ready" });
    });

    it("gate returns no-selection when the picker yields an empty selection", async () => {
      mockNativeModule.getAuthorizationStatus.mockReturnValue("approved");
      mockNativeModule.getSavedSelection.mockReturnValue(null);
      mockNativeModule.presentAppPicker.mockResolvedValue(token(0, 0));
      const r = await st.validateAndPromptForAppSelection();
      expect(r).toEqual({ ok: false, reason: "no-selection" });
    });

    it("gate returns no-selection when the picker is cancelled (throws)", async () => {
      mockNativeModule.getAuthorizationStatus.mockReturnValue("approved");
      mockNativeModule.getSavedSelection.mockReturnValue(null);
      mockNativeModule.presentAppPicker.mockRejectedValue(
        new Error("cancelled"),
      );
      const r = await st.validateAndPromptForAppSelection();
      expect(r).toEqual({ ok: false, reason: "no-selection" });
    });
  });
});
