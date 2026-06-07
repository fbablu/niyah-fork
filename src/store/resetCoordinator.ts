/**
 * Non-visual reset coordinator.
 * Clears every user-scoped store on logout or auth loss.
 * Theme store is device-level and is intentionally NOT cleared.
 */

import { useWalletStore } from "./walletStore";
import { useSessionStore } from "./sessionStore";
import { usePartnerStore } from "./partnerStore";
import { useGroupSessionStore } from "./groupSessionStore";
import { useSocialStore } from "./socialStore";
import { useScheduleStore } from "./scheduleStore";

export function resetAllUserStores(): void {
  useWalletStore.getState().reset();
  useSessionStore.getState().reset();
  usePartnerStore.getState().reset();
  useGroupSessionStore.getState().reset();
  useSocialStore.getState().reset();
  // Disarms every DeviceActivity schedule + clears persisted templates so the
  // next account on this device doesn't inherit scheduled blocks.
  useScheduleStore.getState().reset();
}
