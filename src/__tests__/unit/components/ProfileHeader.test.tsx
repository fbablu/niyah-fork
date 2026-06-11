/**
 * Unit Tests for ProfileHeader component (profile-tab-normal header card).
 *
 * Contract: name + email + Following/Partners counters with friends-tab
 * navigation. The blob avatar and reputation badge are intentionally GONE —
 * BlobPlatform owns the avatar zone and CloutCard replaced reputation.
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { ProfileHeader } from "../../../components/profile/ProfileHeader";
import type { User, UserReputation } from "../../../types";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
  }),
}));

const makeReputation = (): UserReputation => ({
  score: 50,
  level: "sapling",
  paymentsCompleted: 3,
  paymentsMissed: 1,
  totalOwedPaid: 1500,
  totalOwedMissed: 500,
  lastUpdated: new Date(),
  referralCount: 0,
});

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: "test-uid",
  email: "alice@test.com",
  name: "Alice",
  balance: 5000,
  currentStreak: 3,
  longestStreak: 7,
  totalSessions: 10,
  completedSessions: 8,
  totalEarnings: 2000,
  createdAt: new Date(),
  reputation: makeReputation(),
  ...overrides,
});

describe("ProfileHeader", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  describe("user info display", () => {
    it("renders user name and email", () => {
      render(
        <ProfileHeader user={makeUser()} followingCount={5} partnerCount={2} />,
      );
      expect(screen.getByText("Alice")).toBeTruthy();
      expect(screen.getByText("alice@test.com")).toBeTruthy();
    });

    it("shows '?' when user is null", () => {
      render(<ProfileHeader user={null} followingCount={0} partnerCount={0} />);
      expect(screen.getByText("?")).toBeTruthy();
    });

    it("shows '?' when user name is undefined", () => {
      const user = makeUser({ name: undefined as unknown as string });
      render(<ProfileHeader user={user} followingCount={0} partnerCount={0} />);
      expect(screen.getByText("?")).toBeTruthy();
    });
  });

  describe("redesign: avatar and reputation moved out of the header", () => {
    it("renders no blob-edit affordance (BlobPlatform owns the avatar zone)", () => {
      render(
        <ProfileHeader user={makeUser()} followingCount={0} partnerCount={0} />,
      );
      expect(screen.queryByLabelText("Edit your blob")).toBeNull();
    });

    it("renders no reputation badge (CloutCard replaced it)", () => {
      render(
        <ProfileHeader user={makeUser()} followingCount={0} partnerCount={0} />,
      );
      expect(screen.queryByText(/\/100/)).toBeNull();
      expect(screen.queryByText(/Sapling/)).toBeNull();
    });
  });

  describe("stats row", () => {
    it("renders following and partner counts", () => {
      render(
        <ProfileHeader
          user={makeUser()}
          followingCount={12}
          partnerCount={3}
        />,
      );
      expect(screen.getByText("12")).toBeTruthy();
      expect(screen.getByText("Following")).toBeTruthy();
      expect(screen.getByText("3")).toBeTruthy();
      expect(screen.getByText("Partners")).toBeTruthy();
    });

    it("renders zero counts", () => {
      render(
        <ProfileHeader user={makeUser()} followingCount={0} partnerCount={0} />,
      );
      expect(screen.getAllByText("0")).toHaveLength(2);
    });
  });

  describe("navigation on stat press", () => {
    it("navigates to friends tab with 'following' param when following is pressed", () => {
      render(
        <ProfileHeader user={makeUser()} followingCount={5} partnerCount={2} />,
      );
      fireEvent.press(screen.getByText("Following"));
      expect(mockPush).toHaveBeenCalledWith({
        pathname: "/(tabs)/friends",
        params: { tab: "following" },
      });
    });

    it("navigates to friends tab with 'partners' param when partners is pressed", () => {
      render(
        <ProfileHeader user={makeUser()} followingCount={5} partnerCount={2} />,
      );
      fireEvent.press(screen.getByText("Partners"));
      expect(mockPush).toHaveBeenCalledWith({
        pathname: "/(tabs)/friends",
        params: { tab: "partners" },
      });
    });
  });
});
