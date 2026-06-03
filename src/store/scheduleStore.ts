import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ScheduledTemplate } from "../types";
import {
  type SchedulePreset,
  presetToTemplate,
  templatesConflict,
} from "../constants/scheduleTemplates";
import {
  startScheduledBlocking,
  stopScheduledBlocking,
} from "../config/screentime";
import { SCHEDULED_STAKE_ENABLED } from "../constants/config";
import { generateId } from "../utils/id";
import { logger } from "../utils/logger";

/**
 * Recurring "Opal-style" scheduled focus blocks.
 *
 * Phase 1 (this build): local-persisted templates + OS-enforced auto-start of
 * FREE blocks via DeviceActivitySchedule. Two deliberate limitations, tracked
 * in docs/schedule-templates-plan-2026-06-03.md:
 *   - Native wrapper applies a DAILY window — per-weekday enforcement needs a
 *     native extension (rebuild). `days` is stored for the UI + Phase 1.5.
 *   - `stakeCents > 0` is INERT — auto-staking on a schedule needs a server CF
 *     (Phase 2). We never auto-debit here; staked templates still arm the free
 *     block so the habit loop works until the CF lands.
 */

const activityNameFor = (id: string) => `niyah_sched_${id}`;

/** Fire-and-forget: arm the OS schedule for a template (no-op off-device). */
const armNative = (t: ScheduledTemplate): void => {
  // Only warn when a stake is set BUT the feature is still dormant — i.e. the
  // stake really is inert. With the flag on, the server auto-stakes at block
  // start (the client still arms the free block here either way), so the
  // "not active yet" warning would be misleading.
  if (t.stakeCents > 0 && !SCHEDULED_STAKE_ENABLED) {
    logger.warn(
      `scheduleStore: template ${t.id} has a stake but auto-stake is not active yet (Phase 2) — arming a free block.`,
    );
  }
  startScheduledBlocking(
    t.startHour,
    t.startMinute,
    t.endHour,
    t.endMinute,
    activityNameFor(t.id),
  ).catch((err) =>
    logger.warn("scheduleStore: startScheduledBlocking failed:", err),
  );
};

/** Fire-and-forget: clear the OS schedule for a template id. */
const disarmNative = (id: string): void => {
  stopScheduledBlocking(activityNameFor(id)).catch((err) =>
    logger.warn("scheduleStore: stopScheduledBlocking failed:", err),
  );
};

interface ScheduleStore {
  templates: ScheduledTemplate[];
  _hasHydrated: boolean;

  /** Create a template from a preset blueprint. Returns the created template,
   * or `null` if it would overlap/duplicate an existing block. */
  addPreset: (preset: SchedulePreset) => ScheduledTemplate | null;
  /** Patch a template; re-arms the OS schedule if it's enabled. */
  updateTemplate: (id: string, patch: Partial<ScheduledTemplate>) => void;
  /** Delete a template and clear its OS schedule. */
  removeTemplate: (id: string) => void;
  /** Enable/disable a template — arms or clears its OS schedule. */
  setEnabled: (id: string, enabled: boolean) => void;
  /** Set a template's stake (cents); 0 = free block. Display-only in Phase 2
   * (gated by SCHEDULED_STAKE_ENABLED) — the server, not the client, debits at
   * the block start, so this does NOT touch the wallet or re-arm the OS block. */
  updateStake: (id: string, stakeCents: number) => void;
  /** Re-arm every enabled template's OS schedule (call on app launch). */
  syncNative: () => void;
}

export const useScheduleStore = create<ScheduleStore>()(
  persist(
    (set, get) => ({
      templates: [],
      _hasHydrated: false,

      addPreset: (preset) => {
        const template = presetToTemplate(preset, generateId(), Date.now());
        // Refuse overlapping/duplicate blocks (same weekday + intersecting
        // time window) — two blocks can't fight the same hours.
        if (get().templates.some((t) => templatesConflict(t, template))) {
          return null;
        }
        set((s) => ({ templates: [...s.templates, template] }));
        if (template.enabled) armNative(template);
        return template;
      },

      updateTemplate: (id, patch) => {
        let updated: ScheduledTemplate | undefined;
        set((s) => ({
          templates: s.templates.map((t) => {
            if (t.id !== id) return t;
            updated = { ...t, ...patch, id: t.id }; // id is immutable
            return updated;
          }),
        }));
        if (!updated) return;
        // Re-arm so time/window edits take effect; clear if now disabled.
        if (updated.enabled) armNative(updated);
        else disarmNative(id);
      },

      removeTemplate: (id) => {
        set((s) => ({ templates: s.templates.filter((t) => t.id !== id) }));
        disarmNative(id);
      },

      setEnabled: (id, enabled) => {
        let target: ScheduledTemplate | undefined;
        set((s) => ({
          templates: s.templates.map((t) => {
            if (t.id !== id) return t;
            target = { ...t, enabled };
            return target;
          }),
        }));
        if (!target) return;
        if (enabled) armNative(target);
        else disarmNative(id);
      },

      updateStake: (id, stakeCents) => {
        const cents = Math.max(0, Math.round(stakeCents));
        set((s) => ({
          templates: s.templates.map((t) =>
            t.id === id ? { ...t, stakeCents: cents } : t,
          ),
        }));
        // Intentionally does NOT re-arm: the OS block is the same free window
        // either way; auto-staking happens server-side (Phase 2 CF), so a stake
        // change never moves money or re-arms a native schedule here.
      },

      syncNative: () => {
        for (const t of get().templates) {
          if (t.enabled) armNative(t);
          else disarmNative(t.id);
        }
      },
    }),
    {
      name: "niyah-schedule-templates",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ templates: s.templates }),
      onRehydrateStorage: () => (state) => {
        state?.syncNative();
        if (state) state._hasHydrated = true;
      },
    },
  ),
);
