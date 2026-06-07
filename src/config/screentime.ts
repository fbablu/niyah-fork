import { Platform } from "react-native";
import {
  NiyahScreenTime,
  type AuthorizationStatus,
  type AppSelectionToken,
  type SelectionTemplate,
  type ShieldViolationEvent,
  type BaselineApp,
  type LiveActivityStartPayload,
  type LiveActivityState,
} from "../../modules/niyah-screentime";
import { LANE_B_ENABLED } from "../constants/config";

// ---------------------------------------------------------------------------
// Feature availability
// ---------------------------------------------------------------------------

// iOS 16+ physical device only.
export const isScreenTimeAvailable =
  Platform.OS === "ios" && parseInt(Platform.Version as string, 10) >= 16;

// ---------------------------------------------------------------------------
// Authorization
// ---------------------------------------------------------------------------

export const requestScreenTimeAuth = async (): Promise<AuthorizationStatus> => {
  if (!isScreenTimeAvailable) return "denied";
  return NiyahScreenTime.requestAuthorization();
};

export const getScreenTimeAuthStatus = (): AuthorizationStatus => {
  if (!isScreenTimeAvailable) return "denied";
  return NiyahScreenTime.getAuthorizationStatus();
};

// ---------------------------------------------------------------------------
// App selection
// ---------------------------------------------------------------------------

export const presentAppPicker = async (): Promise<AppSelectionToken> => {
  if (!isScreenTimeAvailable) {
    throw new Error("Screen Time API is not available on this device");
  }
  return NiyahScreenTime.presentAppPicker();
};

export const getSavedAppSelection = (): AppSelectionToken | null => {
  if (!isScreenTimeAvailable) return null;
  return NiyahScreenTime.getSavedSelection();
};

export const clearAppSelection = async (): Promise<void> => {
  if (!isScreenTimeAvailable) return;
  return NiyahScreenTime.clearSelection();
};

// ---------------------------------------------------------------------------
// Block-list templates (named selections)
// ---------------------------------------------------------------------------

/** Snapshot the CURRENT selection as a named template (same-name overwrites).
 *  Throws with a user-presentable message if nothing is selected. */
export const saveSelectionTemplate = async (
  name: string,
): Promise<SelectionTemplate> => {
  if (!isScreenTimeAvailable) {
    throw new Error("Screen Time API is not available on this device");
  }
  return NiyahScreenTime.saveSelectionTemplate(name);
};

/** Saved template summaries (never tokens). Empty off-device. */
export const listSelectionTemplates = (): SelectionTemplate[] => {
  if (!isScreenTimeAvailable) return [];
  try {
    return NiyahScreenTime.listSelectionTemplates() ?? [];
  } catch {
    return [];
  }
};

/** Load a template into the active selection (write-through). Null when the
 *  template is missing or Screen Time is unavailable. */
export const applySelectionTemplate = async (
  name: string,
): Promise<AppSelectionToken | null> => {
  if (!isScreenTimeAvailable) return null;
  try {
    return await NiyahScreenTime.applySelectionTemplate(name);
  } catch {
    return null;
  }
};

export const deleteSelectionTemplate = async (name: string): Promise<void> => {
  if (!isScreenTimeAvailable) return;
  try {
    await NiyahScreenTime.deleteSelectionTemplate(name);
  } catch {
    // best-effort
  }
};

// ---------------------------------------------------------------------------
// Never-block list (apps that stay available during every block)
// ---------------------------------------------------------------------------

/** Present the (seeded) picker for the never-block list. Rejects on cancel —
 *  same contract as presentAppPicker. */
export const presentNeverBlockPicker = async (): Promise<AppSelectionToken> => {
  if (!isScreenTimeAvailable) {
    throw new Error("Screen Time API is not available on this device");
  }
  return NiyahScreenTime.presentNeverBlockPicker();
};

export const getNeverBlockSummary = (): AppSelectionToken | null => {
  if (!isScreenTimeAvailable) return null;
  try {
    return NiyahScreenTime.getNeverBlockSummary();
  } catch {
    return null;
  }
};

export const clearNeverBlockSelection = async (): Promise<void> => {
  if (!isScreenTimeAvailable) return;
  try {
    await NiyahScreenTime.clearNeverBlockSelection();
  } catch {
    // best-effort
  }
};

/** Sign-out/delete hygiene — wipes selection, templates, never-block list,
 *  shield context and violation counters so the next account starts clean. */
export const clearAllSelections = async (): Promise<void> => {
  if (!isScreenTimeAvailable) return;
  try {
    await NiyahScreenTime.clearAllSelections();
  } catch {
    // best-effort
  }
};

/** A selection counts as non-empty if it names apps OR whole categories. */
const selectionHasApps = (s: AppSelectionToken | null): boolean =>
  !!s && s.appCount + s.categoryCount > 0;

export interface AppSelectionStatus {
  /** Screen Time API usable here (iOS 16+ physical device). */
  available: boolean;
  /** FamilyControls authorization granted. */
  authorized: boolean;
  /** A non-empty app/category selection is saved. */
  hasApps: boolean;
  /** The saved selection, if any. */
  selection: AppSelectionToken | null;
}

/**
 * Pure snapshot of whether this device is ready to actually block apps — no
 * prompts, no side effects, safe to call every render to drive a
 * "Setup Required" affordance and gate a session-start button.
 *
 * When Screen Time isn't available (simulator, iOS <16, Android) reports
 * `available:false` with `authorized`/`hasApps` true so callers DON'T trap the
 * user — blocking simply can't apply there (matches startBlocking's no-op).
 */
export const getAppSelectionStatus = (): AppSelectionStatus => {
  if (!isScreenTimeAvailable) {
    return {
      available: false,
      authorized: true,
      hasApps: true,
      selection: null,
    };
  }
  const selection = getSavedAppSelection();
  return {
    available: true,
    authorized: getScreenTimeAuthStatus() === "approved",
    hasApps: selectionHasApps(selection),
    selection,
  };
};

/**
 * The current saved selection as a shareable, human-readable block summary —
 * or undefined if nothing (or an empty selection) is saved. NO opaque tokens
 * (device-local); just counts + the native label, safe to store on a group
 * session doc so members can see what each other is blocking.
 */
export const getSavedAppBlockSummary = ():
  | { appCount: number; categoryCount: number; label: string }
  | undefined => {
  const s = getSavedAppSelection();
  if (!selectionHasApps(s)) return undefined;
  return {
    appCount: s!.appCount,
    categoryCount: s!.categoryCount,
    label: s!.label,
  };
};

export type AppSelectionGate =
  | {
      ok: true;
      reason: "ready" | "unavailable";
      selection: AppSelectionToken | null;
    }
  | { ok: false; reason: "needs-auth" | "no-selection" };

/**
 * Imperative gate for a session-start handler: ensure Screen Time is authorized
 * AND a non-empty selection exists, PROMPTING for each if missing.
 *  - unavailable device → ok (blocking can't apply; don't trap the user)
 *  - auth denied/declined → { ok:false, reason:"needs-auth" }
 *  - picker cancelled / still empty → { ok:false, reason:"no-selection" }
 *
 * Gate on `ok` before starting (and charging) a staked session — a staked
 * session must never run unshielded. The prior bug: callers invoked
 * startBlocking() with no selection, the native module threw, the error was
 * swallowed, and the stake was charged for a session that blocked nothing.
 */
export const validateAndPromptForAppSelection =
  async (): Promise<AppSelectionGate> => {
    if (!isScreenTimeAvailable) {
      return { ok: true, reason: "unavailable", selection: null };
    }

    if (getScreenTimeAuthStatus() !== "approved") {
      try {
        if ((await requestScreenTimeAuth()) !== "approved") {
          return { ok: false, reason: "needs-auth" };
        }
      } catch {
        return { ok: false, reason: "needs-auth" };
      }
    }

    let selection = getSavedAppSelection();
    if (!selectionHasApps(selection)) {
      try {
        selection = await presentAppPicker();
      } catch {
        return { ok: false, reason: "no-selection" };
      }
      if (!selectionHasApps(selection)) {
        return { ok: false, reason: "no-selection" };
      }
    }

    return { ok: true, reason: "ready", selection };
  };

// ---------------------------------------------------------------------------
// Session blocking
// ---------------------------------------------------------------------------

export const startBlocking = async (): Promise<void> => {
  if (!isScreenTimeAvailable) return;
  return NiyahScreenTime.startBlocking();
};

export const stopBlocking = async (): Promise<void> => {
  if (!isScreenTimeAvailable) return;
  return NiyahScreenTime.stopBlocking();
};

export const isBlocking = (): boolean => {
  if (!isScreenTimeAvailable) return false;
  return NiyahScreenTime.isBlocking();
};

// ---------------------------------------------------------------------------
// Scheduled blocking
// ---------------------------------------------------------------------------

export const startScheduledBlocking = async (
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
  activityName: string,
): Promise<void> => {
  if (!isScreenTimeAvailable) return;
  return NiyahScreenTime.startScheduledBlocking(
    startHour,
    startMinute,
    endHour,
    endMinute,
    activityName,
  );
};

export const stopScheduledBlocking = async (
  activityName: string,
): Promise<void> => {
  if (!isScreenTimeAvailable) return;
  return NiyahScreenTime.stopScheduledBlocking(activityName);
};

export const stopAllScheduledBlocking = async (): Promise<void> => {
  if (!isScreenTimeAvailable) return;
  return NiyahScreenTime.stopAllScheduledBlocking();
};

// ---------------------------------------------------------------------------
// Session context (for dynamic shield)
// ---------------------------------------------------------------------------

/**
 * Set session context so the shield extension can display dynamic messages
 * with participant names and stake amounts during group sessions.
 */
export const setSessionContext = async (context: {
  names: string[];
  stake: number;
  type: "solo" | "group";
}): Promise<void> => {
  if (!isScreenTimeAvailable) return;
  return NiyahScreenTime.setSessionContext(JSON.stringify(context));
};

/**
 * Clear session context (call when session ends).
 */
export const clearSessionContext = async (): Promise<void> => {
  if (!isScreenTimeAvailable) return;
  return NiyahScreenTime.clearSessionContext();
};

// ---------------------------------------------------------------------------
// Violation breakdown
// ---------------------------------------------------------------------------

/**
 * Per-category blocked-app attempt counts for the current session, classified
 * by the shield extension ("social" | "video" | "gaming" | "news" | "other").
 * Per-app names are impossible (Apple privacy model) — this is the ceiling.
 * Cleared natively on startBlocking; read before stopBlocking for analytics.
 */
export const getViolationsByCategory = (): Record<string, number> => {
  if (!isScreenTimeAvailable) return {};
  try {
    return NiyahScreenTime.getViolationsByCategory() ?? {};
  } catch {
    return {};
  }
};

// ---------------------------------------------------------------------------
// Violation events
// ---------------------------------------------------------------------------

/**
 * Subscribe to shield violation events (user opened a blocked app).
 * Returns an unsubscribe function.
 *
 * Usage:
 *   const unsub = onShieldViolation((event) => {
 *     console.log("Violation at", event.timestamp);
 *     // Deduct money from wallet
 *   });
 *   // Later: unsub();
 */
export const onShieldViolation = (
  callback: (event: ShieldViolationEvent) => void,
): (() => void) => {
  if (!isScreenTimeAvailable) return () => {};

  const subscription = NiyahScreenTime.addListener(
    "onShieldViolation",
    callback,
  );
  return () => subscription.remove();
};

export const onAuthorizationChange = (
  callback: (status: AuthorizationStatus) => void,
): (() => void) => {
  if (!isScreenTimeAvailable) return () => {};

  const subscription = NiyahScreenTime.addListener(
    "onAuthorizationChange",
    (event) => callback(event.status),
  );
  return () => subscription.remove();
};

/**
 * Subscribe to surrender requests from the custom shield screen.
 * Fired when the user taps "Surrender Session" on the NiyahShieldAction
 * extension. The main app should call surrenderSession() in response.
 * Returns an unsubscribe function.
 */
export const onSurrenderRequested = (callback: () => void): (() => void) => {
  if (!isScreenTimeAvailable) return () => {};

  const subscription = NiyahScreenTime.addListener(
    "onSurrenderRequested",
    callback,
  );
  return () => subscription.remove();
};

/**
 * Check for a pending surrender flag from the shield extension.
 * Call on mount to catch surrenders that happened before the JS event
 * listener was attached (cold-start race condition). If a pending
 * surrender is found, clears the flag and emits onSurrenderRequested.
 */
export const checkPendingSurrender = (): boolean => {
  if (!isScreenTimeAvailable) return false;
  return NiyahScreenTime.checkPendingSurrender();
};

// ---------------------------------------------------------------------------
// DeviceActivityReport baseline (Lane B2)
// ---------------------------------------------------------------------------

/**
 * Return the user's per-app baseline (top-N by daily-average minutes).
 * The NiyahDeviceActivityReport extension populates this on its own
 * schedule (typically every few hours after first authorization).
 *
 * Returns an empty array when:
 *   - Screen Time isn't available (non-iOS, iOS <16, missing entitlement)
 *   - The extension hasn't yet aggregated data (first ~24h)
 *   - LANE_B_ENABLED is false (extension not registered in build)
 */
export const getScreenTimeBaseline = (): BaselineApp[] => {
  if (!isScreenTimeAvailable || !LANE_B_ENABLED) return [];
  try {
    return NiyahScreenTime.getScreenTimeBaseline();
  } catch {
    return [];
  }
};

// ---------------------------------------------------------------------------
// Live Activity (Lane B7)
// ---------------------------------------------------------------------------

/**
 * Start a Live Activity for the current session. No-op when Lane B is
 * disabled or Screen Time / ActivityKit isn't available.
 *
 * Pass the full payload (static attrs + initial dynamic state). The
 * widget reads `endsAt` and lets the system tick the timer locally — we
 * do NOT need to call updateLiveActivity every second.
 *
 * Call sites:
 *   - sessionStore.startSession (solo)
 *   - groupSessionStore.startSession (group)
 */
export const startLiveActivity = async (
  payload: LiveActivityStartPayload,
): Promise<boolean> => {
  if (!isScreenTimeAvailable || !LANE_B_ENABLED) return false;
  return NiyahScreenTime.startLiveActivity(JSON.stringify(payload));
};

/**
 * Push a new dynamic state to the active Live Activity. Used when the
 * leaderboard composition or payout share shifts meaningfully — not on
 * every tick.
 */
export const updateLiveActivity = async (
  state: LiveActivityState,
): Promise<boolean> => {
  if (!isScreenTimeAvailable || !LANE_B_ENABLED) return false;
  return NiyahScreenTime.updateLiveActivity(JSON.stringify(state));
};

/** End the active Live Activity. Call on complete or surrender. */
export const endLiveActivity = async (): Promise<boolean> => {
  if (!isScreenTimeAvailable || !LANE_B_ENABLED) return false;
  return NiyahScreenTime.endLiveActivity();
};
