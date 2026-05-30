import { create } from "zustand";
import { Partner } from "../types";
import { DEMO_MODE } from "../constants/config";
import { useAuthStore } from "./authStore";
import { fetchUserProfile, awardReferralToUser } from "../config/firebase";
import { generateId } from "../utils/id";

interface PartnerState {
  currentPartner: Partner | null;
  partners: Partner[];
  pendingInvites: PartnerInvite[];

  addPartner: (
    partner: Omit<
      Partner,
      "id" | "connectedAt" | "totalSessionsTogether" | "isActive"
    >,
  ) => void;
  removePartner: (oderId: string) => void;
  selectPartner: (oderId: string) => void;
  sendInvite: (email: string, name: string) => void;
  acceptInvite: (inviteId: string) => void;
  // Called on the new user's device after they authenticate via a referral link.
  // Fetches the referrer's name, boosts the new user's reputation, and awards the referrer.
  applyReferralBonus: (referrerUid: string) => Promise<void>;
  reset: () => void;
}

interface PartnerInvite {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toEmail: string;
  toName: string;
  status: "pending" | "accepted" | "declined";
  createdAt: Date;
}

const DEMO_PARTNER: Partner = {
  id: "demo-partner-1",
  oderId: "partner-user-1",
  name: "Fardeen Bablu",
  email: "fardeen@example.com",
  reputation: {
    score: 72,
    level: "tree",
    paymentsCompleted: 8,
    paymentsMissed: 1,
    totalOwedPaid: 4500, // $45 paid
    totalOwedMissed: 500, // $5 missed once
    lastUpdated: new Date(),
    referralCount: 0,
  },
  connectedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
  totalSessionsTogether: 5,
  isActive: false,
};

export const usePartnerStore = create<PartnerState>((set, get) => ({
  currentPartner: null,
  partners: DEMO_MODE ? [DEMO_PARTNER] : [],
  pendingInvites: [],

  addPartner: (partnerData) => {
    const partner: Partner = {
      ...partnerData,
      id: generateId(),
      connectedAt: new Date(),
      totalSessionsTogether: 0,
      isActive: false,
    };

    set((state) => ({
      partners: [...state.partners, partner],
    }));
  },

  removePartner: (oderId: string) => {
    set((state) => ({
      partners: state.partners.filter((p) => p.oderId !== oderId),
      currentPartner:
        state.currentPartner?.oderId === oderId ? null : state.currentPartner,
    }));
  },

  selectPartner: (oderId: string) => {
    const { partners } = get();
    const partner = partners.find((p) => p.oderId === oderId);
    set({ currentPartner: partner || null });
  },

  sendInvite: (email: string, name: string) => {
    const authStore = useAuthStore.getState();
    const invite: PartnerInvite = {
      id: generateId(),
      fromUserId: authStore.user?.id || "",
      fromUserName: authStore.user?.name || "",
      toEmail: email,
      toName: name,
      status: "pending",
      createdAt: new Date(),
    };

    set((state) => ({
      pendingInvites: [...state.pendingInvites, invite],
    }));
  },

  acceptInvite: (inviteId: string) => {
    const { pendingInvites, addPartner } = get();
    const invite = pendingInvites.find((i) => i.id === inviteId);

    if (invite) {
      // Use the inviter's name/ID. The invite's toEmail is the *invitee's* email,
      // so we don't use it as the partner's email — leave blank until fetched.
      addPartner({
        oderId: invite.fromUserId,
        name: invite.fromUserName,
        email: "",
        reputation: {
          score: 50,
          level: "sapling",
          paymentsCompleted: 0,
          paymentsMissed: 0,
          totalOwedPaid: 0,
          totalOwedMissed: 0,
          lastUpdated: new Date(),
          referralCount: 0,
        },
      });

      set((state) => ({
        pendingInvites: state.pendingInvites.map((i) =>
          i.id === inviteId ? { ...i, status: "accepted" as const } : i,
        ),
      }));
    }
  },

  applyReferralBonus: async (referrerUid: string) => {
    const { partners } = get();

    // Idempotency: do nothing if this referrer is already in the partner list
    if (partners.some((p) => p.oderId === referrerUid)) return;

    let referrerName = "Unknown";
    try {
      const profile = await fetchUserProfile(referrerUid);
      if (profile?.name) {
        referrerName = profile.name as string;
      } else if (profile?.firstName) {
        referrerName = `${profile.firstName}${profile.lastName ? " " + profile.lastName : ""}`;
      }
    } catch {
      // Non-critical — fall back to "Unknown"
    }

    const newPartner: Partner = {
      id: generateId(),
      oderId: referrerUid,
      name: referrerName,
      tag: "Your Referrer",
      email: "",
      reputation: {
        score: 50,
        level: "sapling",
        paymentsCompleted: 0,
        paymentsMissed: 0,
        totalOwedPaid: 0,
        totalOwedMissed: 0,
        lastUpdated: new Date(),
        referralCount: 0,
      },
      connectedAt: new Date(),
      totalSessionsTogether: 0,
      isActive: false,
    };

    set((state) => ({ partners: [...state.partners, newPartner] }));

    const authStore = useAuthStore.getState();
    const currentCount = authStore.user?.reputation.referralCount ?? 0;
    authStore.updateReputation({ referralCount: currentCount + 1 });

    awardReferralToUser(referrerUid);
  },

  reset: () => {
    set({
      currentPartner: null,
      partners: [],
      pendingInvites: [],
    });
  },
}));
