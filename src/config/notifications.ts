/**
 * FCM Push Notification setup for Niyah.
 *
 * Handles:
 * - Permission request
 * - FCM token management (register/refresh/remove)
 * - Foreground message handling
 * - Background message handling
 * - Deep link navigation from notifications
 */

import {
  getMessaging,
  requestPermission,
  hasPermission,
  AuthorizationStatus,
  getToken,
  getAPNSToken,
  onTokenRefresh as subscribeToTokenRefresh,
  onMessage as subscribeToMessages,
  setBackgroundMessageHandler,
  getInitialNotification,
  onNotificationOpenedApp,
} from "@react-native-firebase/messaging";
import { getAuth } from "@react-native-firebase/auth";
import {
  registerPushToken as cloudRegisterPushToken,
  removePushToken as cloudRemovePushToken,
} from "./functions";
import { Platform } from "react-native";
import { router, type RelativePathString } from "expo-router";
import notifee, {
  AndroidImportance,
  EventType,
  TriggerType,
  type TimestampTrigger,
} from "@notifee/react-native";
import { logger } from "../utils/logger";
import AsyncStorage from "@react-native-async-storage/async-storage";

const NOTIFEE_CHANNEL_ID = "niyah-default";
let notifeeChannelCreated = false;

async function ensureNotifeeChannel(): Promise<void> {
  if (notifeeChannelCreated || Platform.OS !== "android") return;
  await notifee.createChannel({
    id: NOTIFEE_CHANNEL_ID,
    name: "Niyah Notifications",
    importance: AndroidImportance.HIGH,
  });
  notifeeChannelCreated = true;
}

const getMessagingInstance = () => getMessaging();

function isMissingAPNSTokenError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("No APNS token specified before fetching FCM Token")
  );
}

async function getCurrentFCMToken(): Promise<string | null> {
  const messaging = getMessagingInstance();

  if (Platform.OS === "ios") {
    const apnsToken = await getAPNSToken(messaging);

    if (!apnsToken) {
      logger.info("APNS token not ready yet; waiting for FCM token refresh");
      return null;
    }
  }

  return getToken(messaging);
}

// ─── Permission ─────────────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  const authStatus = await requestPermission(getMessagingInstance());
  const enabled =
    authStatus === AuthorizationStatus.AUTHORIZED ||
    authStatus === AuthorizationStatus.PROVISIONAL;

  if (!enabled) {
    logger.warn("Notification permission not granted");
  }

  return enabled;
}

/**
 * Current notification permission status WITHOUT prompting — never shows the
 * OS dialog. Used by initializeNotifications() on sign-in so we only wire up
 * push for users who have *already* granted it; the first-time OS prompt is
 * triggered explicitly from the onboarding priming screen (enableNotifications).
 */
export async function hasNotificationPermission(): Promise<boolean> {
  const authStatus = await hasPermission(getMessagingInstance());
  return (
    authStatus === AuthorizationStatus.AUTHORIZED ||
    authStatus === AuthorizationStatus.PROVISIONAL
  );
}

// ─── Token Management ───────────────────────────────────────────────────────

/**
 * Register the current device's FCM token via the registerPushToken CF.
 * The CF writes to the server-only `userPushTokens/{uid}` collection (which
 * is unreadable from clients). The legacy `users.fcmTokens` field is left
 * untouched in old user docs until `migrateSensitiveFieldsToPrivate` runs.
 */
export async function registerFCMToken(): Promise<void> {
  try {
    const user = getAuth().currentUser;
    if (!user) return;

    const token = await getCurrentFCMToken();
    if (!token) {
      logger.warn("FCM token unavailable — will retry on next foreground");
      return;
    }

    await cloudRegisterPushToken(token);
    logger.info("FCM token registered");
  } catch (error) {
    if (Platform.OS === "ios" && isMissingAPNSTokenError(error)) {
      logger.info("APNS token not ready yet; waiting for FCM token refresh");
      return;
    }

    logger.error("Failed to register FCM token:", error);
  }
}

/** Remove the current device's FCM token via the removePushToken CF. */
export async function removeFCMToken(_uid: string): Promise<void> {
  try {
    const token = await getCurrentFCMToken();
    if (!token) return;

    await cloudRemovePushToken(token);
    logger.info("FCM token removed");
  } catch (error) {
    if (Platform.OS === "ios" && isMissingAPNSTokenError(error)) {
      logger.info("APNS token not ready yet; skipping FCM token removal");
      return;
    }

    logger.error("Failed to remove FCM token:", error);
  }
}

/** Listen for token refreshes and update via CF. */
export function onTokenRefresh(): () => void {
  return subscribeToTokenRefresh(getMessagingInstance(), async (newToken) => {
    const user = getAuth().currentUser;
    if (!user) return;

    try {
      await cloudRegisterPushToken(newToken);
      logger.info("FCM token refreshed");
    } catch (err) {
      logger.error("FCM token refresh registration failed:", err);
    }
  });
}

// ─── Message Handling ───────────────────────────────────────────────────────

/** Handle notification taps that opened the app from background/quit state. */
function handleNotificationNavigation(
  data: Record<string, string> | undefined,
): void {
  if (!data) return;

  const { type, sessionId } = data;

  switch (type) {
    case "group_invite":
      router.push("/session/invites" as RelativePathString);
      break;
    case "invite_response":
    case "session_ready":
      if (sessionId)
        router.push(
          `/session/waiting-room?sessionId=${sessionId}` as RelativePathString,
        );
      break;
    case "session_started":
      router.push("/session/active");
      break;
    case "session_complete":
      router.push("/session/complete");
      break;
    // In-session pushes — they're informational; keep the user on the
    // active screen instead of forcing a navigation. Tapping the banner
    // still routes there in case the app was backgrounded.
    case "member_app_opened":
    case "session_surrender":
    case "leaderboard_shift":
    case "session_progress_25":
    case "session_progress_50":
    case "session_progress_75":
    case "shield_violation":
      router.push("/session/active");
      break;
    // Two-step shield surrender (Lane B5): tapping the push opens the
    // active session with a query param so the confirm sheet renders.
    case "surrender_confirm_pending":
      router.push(
        "/session/active?confirmSurrender=true" as RelativePathString,
      );
      break;
    // Local retention reminders (scheduled client-side via scheduleRetentionReminder).
    case "streak_at_risk":
    case "reengagement":
      router.push("/session/select?type=solo" as RelativePathString);
      break;
    case "scheduled_block_reminder":
      router.push("/(tabs)/schedule" as RelativePathString);
      break;
    case "low_balance":
      router.push("/session/deposit" as RelativePathString);
      break;
    default:
      break;
  }
}

/** Set up foreground message handler — displays a system-style banner via notifee. */
export function setupForegroundHandler(): () => void {
  // Apple "critical alert" level requires a special entitlement reserved for
  // health/safety apps. timeSensitive bypasses Focus modes without that gate.
  const unsubMessages = subscribeToMessages(
    getMessagingInstance(),
    async (remoteMessage) => {
      // A throw here (channel creation / permission / network) would surface as
      // an unhandled promise rejection in the FCM SDK and can crash a live
      // session — log and drop instead, matching setupBackgroundHandler.
      try {
        const { notification, data } = remoteMessage;
        if (!notification) return;

        await ensureNotifeeChannel();
        const payload = (data ?? {}) as Record<string, string>;

        await notifee.displayNotification({
          title: notification.title || "Niyah",
          body: notification.body || "",
          data: payload,
          android: {
            channelId: NOTIFEE_CHANNEL_ID,
            pressAction: { id: "default" },
            smallIcon: "ic_notification",
          },
          ios: {
            sound: "default",
            interruptionLevel: "timeSensitive",
            categoryId: payload.type,
          },
        });
      } catch (err) {
        logger.error("Foreground notification display failed:", err);
      }
    },
  );

  const unsubTap = notifee.onForegroundEvent(({ type, detail }) => {
    if (type !== EventType.PRESS) return;
    const data = detail.notification?.data as
      | Record<string, string>
      | undefined;
    handleNotificationNavigation(data);
  });

  return () => {
    unsubMessages();
    unsubTap();
  };
}

/** Set up background message handler. Must be called at app entry point. */
export function setupBackgroundHandler(): void {
  setBackgroundMessageHandler(getMessagingInstance(), async (remoteMessage) => {
    logger.info("Background message received:", remoteMessage.messageId);
    // Background messages are handled by the system notification tray.
    // Navigation happens via onNotificationOpenedApp when user taps.
  });

  // Local notifications (e.g. the SURRENDER_CONFIRM push scheduled by
  // ShieldActionExtension) bypass FCM and arrive through notifee. Register
  // the background tap handler here at module load so taps from outside the
  // app deep-link correctly even on cold start.
  notifee.onBackgroundEvent(async ({ type, detail }) => {
    if (type !== EventType.PRESS) return;
    const data = detail.notification?.data as
      | Record<string, string>
      | undefined;
    handleNotificationNavigation(data);
  });
}

/** Check if app was opened from a notification (cold start). */
export async function checkInitialNotification(): Promise<void> {
  const initialNotification = await getInitialNotification(
    getMessagingInstance(),
  );
  if (initialNotification) {
    handleNotificationNavigation(
      initialNotification.data as Record<string, string>,
    );
  }
}

/** Set up handler for notification taps when app is in background. */
export function setupNotificationOpenHandler(): () => void {
  return onNotificationOpenedApp(getMessagingInstance(), (remoteMessage) => {
    handleNotificationNavigation(remoteMessage.data as Record<string, string>);
  });
}

// ─── Initialize ─────────────────────────────────────────────────────────────

let initPromise: Promise<() => void> | null = null;
let activeCleanup: (() => void) | null = null;

/** Wire up token refresh + token registration + foreground/open/initial
 * handlers. Caller guarantees permission is already granted. */
async function setupListenersAndToken(): Promise<() => void> {
  const unsubTokenRefresh = onTokenRefresh();
  // A token-registration failure must not orphan unsubTokenRefresh or skip the
  // foreground/open handlers below — they still need to register and land in
  // activeCleanup, or a re-init stacks duplicate listeners.
  try {
    await registerFCMToken();
  } catch (err) {
    logger.error("FCM token registration failed:", err);
  }
  const unsubForeground = setupForegroundHandler();
  const unsubOpen = setupNotificationOpenHandler();

  await checkInitialNotification();

  activeCleanup = () => {
    unsubTokenRefresh();
    unsubForeground();
    unsubOpen();
  };
  return activeCleanup;
}

/**
 * Initialize notification handling WITHOUT ever showing the OS permission
 * dialog. Called on sign-in: if permission is already granted it wires up the
 * listeners + token; otherwise it no-ops and clears the cache so a later
 * enableNotifications() (fired from the onboarding priming screen) can prompt
 * and init. The old contextless sign-in prompt was killing opt-in — an iOS
 * dismissal is permanent. Safe to call repeatedly (returns the in-flight or
 * resolved init; prevents listener stacking across racing auth paths).
 */
export async function initializeNotifications(): Promise<() => void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const granted = await hasNotificationPermission();
    if (!granted) {
      initPromise = null; // let a later enableNotifications() retry
      return () => {};
    }
    return setupListenersAndToken();
  })();

  return initPromise;
}

/**
 * Explicitly request notification permission (shows the OS dialog when the
 * status is not-yet-determined) and, if granted, wire up listeners + token.
 * Triggered from the onboarding priming screen so the prompt appears in
 * context. Returns whether notifications are now enabled.
 */
export async function enableNotifications(): Promise<boolean> {
  const granted = await requestNotificationPermission();
  if (!granted) return false;
  resetNotifications(); // clear any cached no-op init from sign-in
  await initializeNotifications();
  return true;
}

/** Tear down active listeners and clear the init guard so re-login re-inits. */
export function resetNotifications(): void {
  if (activeCleanup) {
    activeCleanup();
    activeCleanup = null;
  }
  initPromise = null;
}

// ─── Session-end scheduled notification ─────────────────────────────────────
// Fires at the moment the timer expires so the user knows the session is done
// even if the app is backgrounded. Notifee schedules with the system, so it
// fires whether or not Niyah is running.

const SESSION_END_NOTIFICATION_ID = "niyah-session-end";

export async function scheduleSessionEndNotification(
  sessionEndsAt: Date,
  body: string,
): Promise<void> {
  await ensureNotifeeChannel();
  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: sessionEndsAt.getTime(),
  };
  try {
    await notifee.createTriggerNotification(
      {
        id: SESSION_END_NOTIFICATION_ID,
        title: "Focus session complete",
        body,
        data: { type: "session_complete" },
        android: {
          channelId: NOTIFEE_CHANNEL_ID,
          pressAction: { id: "default" },
          smallIcon: "ic_notification",
        },
        ios: {
          sound: "default",
          interruptionLevel: "timeSensitive",
        },
      },
      trigger,
    );
  } catch (err) {
    logger.warn("scheduleSessionEndNotification failed:", err);
  }
}

export async function cancelSessionEndNotification(): Promise<void> {
  try {
    await notifee.cancelTriggerNotification(SESSION_END_NOTIFICATION_ID);
  } catch (err) {
    logger.warn("cancelSessionEndNotification failed:", err);
  }
}

// ─── Retention reminders (local, client-only) ───────────────────────────────
// Local nudges scheduled with notifee's timestamp trigger (no server, no push
// token). A per-day dedup guard caps these to one per reason per UTC day so they
// can never pile up into notification fatigue. Functional notifications (e.g.
// session-end above) are exempt — only the reasons below route through the guard.
// All inputs are READ-ONLY over wallet/session/auth state; this schedules nothing
// on the server and moves no money.

export type RetentionReason =
  | "streak_at_risk"
  | "reengagement"
  | "scheduled_block_reminder"
  | "low_balance";

const RETENTION_REMINDER_PREFIX = "niyah-retention-";
const RETENTION_DEDUP_KEY = "@niyah/retention_reminder_log";

const utcDayKey = (ms: number): string =>
  new Date(ms).toISOString().slice(0, 10);

// A `key` (e.g. a template id) lets one reason carry MANY independent reminders
// (separate notifee ids + separate per-day dedup slots) — needed for per-template
// scheduled-block reminders. Omit it for singleton reasons (streak/re-engagement).
const retentionNotifeeId = (reason: RetentionReason, key?: string): string =>
  `${RETENTION_REMINDER_PREFIX}${reason}${key ? `-${key}` : ""}`;
const retentionDedupKey = (reason: RetentionReason, key?: string): string =>
  key ? `${reason}:${key}` : reason;

async function retentionScheduledToday(
  dedup: string,
  fireAtMs: number,
): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(RETENTION_DEDUP_KEY);
    const log = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    return log[dedup] === utcDayKey(fireAtMs);
  } catch {
    return false; // fail open — one possible duplicate beats never firing
  }
}

async function recordRetentionScheduled(
  dedup: string,
  fireAtMs: number,
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(RETENTION_DEDUP_KEY);
    const log = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    log[dedup] = utcDayKey(fireAtMs);
    await AsyncStorage.setItem(RETENTION_DEDUP_KEY, JSON.stringify(log));
  } catch (err) {
    logger.warn("recordRetentionScheduled failed:", err);
  }
}

/**
 * Schedule a local retention reminder. The notifee id is stable per reason, so
 * re-scheduling REPLACES (never stacks). Subject to the per-day dedup guard: at
 * most one reminder per reason per UTC day. `data.type` deep-links on tap (see
 * handleNotificationNavigation). No-ops (returns false) when the fire time is in
 * the past or a reminder for this reason was already scheduled today.
 */
export async function scheduleRetentionReminder(opts: {
  reason: RetentionReason;
  fireAt: Date;
  title: string;
  body: string;
  /** Distinguishes multiple reminders of the same reason (e.g. a template id). */
  key?: string;
  data?: Record<string, string>;
}): Promise<boolean> {
  const fireAtMs = opts.fireAt.getTime();
  if (!Number.isFinite(fireAtMs) || fireAtMs <= Date.now() + 1000) return false;
  const dedup = retentionDedupKey(opts.reason, opts.key);
  if (await retentionScheduledToday(dedup, fireAtMs)) return false;

  await ensureNotifeeChannel();
  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: fireAtMs,
  };
  try {
    await notifee.createTriggerNotification(
      {
        id: retentionNotifeeId(opts.reason, opts.key),
        title: opts.title,
        body: opts.body,
        data: { type: opts.reason, ...(opts.data ?? {}) },
        android: {
          channelId: NOTIFEE_CHANNEL_ID,
          pressAction: { id: "default" },
          smallIcon: "ic_notification",
        },
        ios: { sound: "default" },
      },
      trigger,
    );
    await recordRetentionScheduled(dedup, fireAtMs);
    return true;
  } catch (err) {
    logger.warn(`scheduleRetentionReminder(${opts.reason}) failed:`, err);
    return false;
  }
}

/** Cancel a scheduled retention reminder by reason (+ optional key) when it no
 *  longer applies (e.g. a scheduled block was disabled/deleted). */
export async function cancelRetentionReminder(
  reason: RetentionReason,
  key?: string,
): Promise<void> {
  try {
    await notifee.cancelTriggerNotification(retentionNotifeeId(reason, key));
  } catch (err) {
    logger.warn(`cancelRetentionReminder(${reason}) failed:`, err);
  }
}
