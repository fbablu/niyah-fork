/**
 * Unit Tests for partnerStore
 *
 * Tests partner management, invites, and referral bonuses.
 */

import { usePartnerStore } from "../../../store/partnerStore";
import { useWalletStore } from "../../../store/walletStore";
import { useAuthStore } from "../../../store/authStore";
import { INITIAL_BALANCE } from "../../../constants/config";
import type { UserReputation } from "../../../types";

jest.mock("../../../config/firebase", () => ({
  fetchUserProfile: jest.fn(),
  awardReferralToUser: jest.fn(),
  updateUserDoc: jest.fn(() => Promise.resolve()),
}));

import {
  fetchUserProfile,
  awardReferralToUser,
} from "../../../config/firebase";

// Helper to create a fresh reputation object
const makeReputation = (
  overrides: Partial<UserReputation> = {},
): UserReputation => ({
  score: 50,
  level: "sapling",
  paymentsCompleted: 0,
  paymentsMissed: 0,
  totalOwedPaid: 0,
  totalOwedMissed: 0,
  lastUpdated: new Date(),
  referralCount: 0,
  ...overrides,
});

describe("partnerStore", () => {
  beforeEach(() => {
    // Reset all stores
    usePartnerStore.setState({
      currentPartner: null,
      partners: [],
      pendingInvites: [],
    });

    useWalletStore.setState({
      balance: INITIAL_BALANCE,
      transactions: [],
      pendingWithdrawal: 0,
    });

    useAuthStore.setState({
      user: {
        id: "test-user",
        email: "test@example.com",
        name: "Test User",
        balance: INITIAL_BALANCE,
        currentStreak: 0,
        longestStreak: 0,
        totalSessions: 0,
        completedSessions: 0,
        totalEarnings: 0,
        createdAt: new Date(),
        reputation: makeReputation(),
      },
      isAuthenticated: true,
      isLoading: false,
    });
  });

  describe("addPartner", () => {
    it("adds a partner with generated id and defaults", () => {
      const { addPartner } = usePartnerStore.getState();

      addPartner({
        oderId: "user-123",
        name: "Alice",
        email: "alice@example.com",
        reputation: makeReputation(),
      });

      const { partners } = usePartnerStore.getState();
      expect(partners).toHaveLength(1);
      expect(partners[0].name).toBe("Alice");
      expect(partners[0].oderId).toBe("user-123");
      expect(partners[0].totalSessionsTogether).toBe(0);
      expect(partners[0].isActive).toBe(false);
      expect(partners[0].id).toBeDefined();
      expect(partners[0].connectedAt).toBeDefined();
    });

    it("can add multiple partners", () => {
      const { addPartner } = usePartnerStore.getState();

      addPartner({
        oderId: "user-1",
        name: "Alice",
        email: "a@test.com",
        reputation: makeReputation(),
      });
      addPartner({
        oderId: "user-2",
        name: "Bob",
        email: "b@test.com",
        reputation: makeReputation(),
      });

      expect(usePartnerStore.getState().partners).toHaveLength(2);
    });
  });

  describe("removePartner", () => {
    it("removes a partner by oderId", () => {
      usePartnerStore.setState({
        partners: [
          {
            id: "p1",
            oderId: "user-1",
            name: "Alice",
            email: "a@test.com",
            reputation: makeReputation(),
            connectedAt: new Date(),
            totalSessionsTogether: 0,
            isActive: false,
          },
        ],
      });

      usePartnerStore.getState().removePartner("user-1");
      expect(usePartnerStore.getState().partners).toHaveLength(0);
    });

    it("clears currentPartner if the removed partner is selected", () => {
      const partner = {
        id: "p1",
        oderId: "user-1",
        name: "Alice",
        email: "a@test.com",
        reputation: makeReputation(),
        connectedAt: new Date(),
        totalSessionsTogether: 0,
        isActive: false,
      };

      usePartnerStore.setState({
        partners: [partner],
        currentPartner: partner,
      });

      usePartnerStore.getState().removePartner("user-1");
      expect(usePartnerStore.getState().currentPartner).toBeNull();
    });
  });

  describe("selectPartner", () => {
    it("sets currentPartner by oderId", () => {
      const partner = {
        id: "p1",
        oderId: "user-1",
        name: "Alice",
        email: "a@test.com",
        reputation: makeReputation(),
        connectedAt: new Date(),
        totalSessionsTogether: 0,
        isActive: false,
      };

      usePartnerStore.setState({ partners: [partner] });
      usePartnerStore.getState().selectPartner("user-1");

      expect(usePartnerStore.getState().currentPartner?.name).toBe("Alice");
    });

    it("sets null if oderId not found", () => {
      usePartnerStore.getState().selectPartner("nonexistent");
      expect(usePartnerStore.getState().currentPartner).toBeNull();
    });
  });

  describe("invites", () => {
    it("sendInvite creates a pending invite", () => {
      usePartnerStore.getState().sendInvite("alice@test.com", "Alice");

      const { pendingInvites } = usePartnerStore.getState();
      expect(pendingInvites).toHaveLength(1);
      expect(pendingInvites[0].toEmail).toBe("alice@test.com");
      expect(pendingInvites[0].toName).toBe("Alice");
      expect(pendingInvites[0].status).toBe("pending");
    });

    it("acceptInvite creates partner and updates invite status", () => {
      usePartnerStore.setState({
        pendingInvites: [
          {
            id: "inv-1",
            fromUserId: "user-alice",
            fromUserName: "Alice",
            toEmail: "me@test.com",
            toName: "Me",
            status: "pending",
            createdAt: new Date(),
          },
        ],
      });

      usePartnerStore.getState().acceptInvite("inv-1");

      const { partners, pendingInvites } = usePartnerStore.getState();
      expect(partners).toHaveLength(1);
      expect(partners[0].name).toBe("Alice");
      expect(pendingInvites[0].status).toBe("accepted");
    });
  });

  // ─── applyReferralBonus ──────────────────────────────────────────────────────

  describe("applyReferralBonus", () => {
    const referrerUid = "referrer-uid-123";

    beforeEach(() => {
      jest.mocked(fetchUserProfile).mockResolvedValue(null);
      jest.mocked(awardReferralToUser).mockResolvedValue(undefined);
    });

    it("adds the referrer as a partner with correct fields", async () => {
      jest.mocked(fetchUserProfile).mockResolvedValueOnce({
        name: "Alice Referrer",
        firstName: undefined,
        lastName: undefined,
      });

      await usePartnerStore.getState().applyReferralBonus(referrerUid);

      const { partners } = usePartnerStore.getState();
      expect(partners).toHaveLength(1);
      expect(partners[0].oderId).toBe(referrerUid);
      expect(partners[0].name).toBe("Alice Referrer");
      expect(partners[0].tag).toBe("Your Referrer");
    });

    it("uses firstName + lastName when name field is absent", async () => {
      jest.mocked(fetchUserProfile).mockResolvedValueOnce({
        name: undefined,
        firstName: "Bob",
        lastName: "Smith",
      });

      await usePartnerStore.getState().applyReferralBonus(referrerUid);

      const { partners } = usePartnerStore.getState();
      expect(partners[0].name).toBe("Bob Smith");
    });

    it("falls back to 'Unknown' when Firestore fetch fails", async () => {
      jest
        .mocked(fetchUserProfile)
        .mockRejectedValueOnce(new Error("Network error"));

      await usePartnerStore.getState().applyReferralBonus(referrerUid);

      const { partners } = usePartnerStore.getState();
      expect(partners).toHaveLength(1);
      expect(partners[0].name).toBe("Unknown");
    });

    it("is idempotent — applying the same referral twice only adds one partner", async () => {
      jest.mocked(fetchUserProfile).mockResolvedValue({ name: "Alice" });

      await usePartnerStore.getState().applyReferralBonus(referrerUid);
      await usePartnerStore.getState().applyReferralBonus(referrerUid);

      // Second call must be a no-op
      expect(usePartnerStore.getState().partners).toHaveLength(1);
    });

    it("increments the current user's referralCount", async () => {
      const initialCount =
        useAuthStore.getState().user?.reputation.referralCount ?? 0;

      await usePartnerStore.getState().applyReferralBonus(referrerUid);

      const newCount =
        useAuthStore.getState().user?.reputation.referralCount ?? 0;
      expect(newCount).toBe(initialCount + 1);
    });

    it("calls awardReferralToUser with the referrer uid", async () => {
      await usePartnerStore.getState().applyReferralBonus(referrerUid);

      expect(awardReferralToUser).toHaveBeenCalledWith(referrerUid);
    });

    it("does not award the referral boost to the wrong uid", async () => {
      await usePartnerStore.getState().applyReferralBonus(referrerUid);

      expect(awardReferralToUser).not.toHaveBeenCalledWith("test-user");
    });
  });
});
