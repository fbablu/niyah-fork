/**
 * Unit tests for SessionReceiptSheet — receipt rows, stake vs no-stake,
 * category sorting, empty state, and the legal-language sweep.
 */

import React from "react";
import {
  render,
  screen,
  fireEvent,
  within,
} from "@testing-library/react-native";
import { SessionReceiptSheet } from "../../../components/profile/SessionReceiptSheet";
import type { CalendarStamp } from "../../../components/profile/SessionCalendar";
import { formatDate } from "../../../utils/format";

const mkStamp = (over: Partial<CalendarStamp> = {}): CalendarStamp => ({
  dateKey: "2026-06-03",
  sessionId: "sess-abc",
  kind: "solo",
  stakeCents: 2500,
  completedAt: new Date(2026, 5, 3, 14, 30),
  ...over,
});

const renderSheet = (over: Record<string, unknown> = {}) =>
  render(
    <SessionReceiptSheet
      visible
      onClose={jest.fn()}
      stamp={mkStamp()}
      {...over}
    />,
  );

describe("SessionReceiptSheet", () => {
  it("renders the receipt: title, date, kind, money stake, Completed status", () => {
    renderSheet();
    expect(screen.getByText("Session receipt")).toBeTruthy();
    expect(
      screen.getByText(formatDate(new Date(2026, 5, 3, 14, 30))),
    ).toBeTruthy();
    expect(screen.getByText("Solo focus")).toBeTruthy();
    expect(screen.getByText("$25.00")).toBeTruthy();
    expect(screen.getByText("Completed")).toBeTruthy();
  });

  it("shows 'With friends' for group sessions and 'No stake' at zero cents", () => {
    renderSheet({ stamp: mkStamp({ kind: "group", stakeCents: 0 }) });
    expect(screen.getByText("With friends")).toBeTruthy();
    expect(screen.getByText("No stake")).toBeTruthy();
    expect(screen.queryByText("$0.00")).toBeNull();
  });

  it("sorts app-usage categories by open count desc, skipping zero counts", () => {
    renderSheet({
      byCategory: { social: 3, games: 5, productivity: 0, entertainment: 1 },
    });
    expect(
      within(screen.getByTestId("receipt-category-0")).getByText("Games"),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId("receipt-category-0")).getByText(
        "opened 5 times",
      ),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId("receipt-category-1")).getByText("Social"),
    ).toBeTruthy();
    // singular form for one open
    expect(
      within(screen.getByTestId("receipt-category-2")).getByText(
        "opened 1 time",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("Productivity")).toBeNull();
    expect(screen.queryByText("No app activity recorded.")).toBeNull();
  });

  it("shows the quiet empty line when no category data exists", () => {
    renderSheet(); // byCategory omitted
    expect(screen.getByText("No app activity recorded.")).toBeTruthy();

    renderSheet({ byCategory: {} });
    expect(
      screen.getAllByText("No app activity recorded.").length,
    ).toBeGreaterThan(0);
  });

  it("calls onClose from the close button", () => {
    const onClose = jest.fn();
    renderSheet({ onClose });
    fireEvent.press(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders nothing receipt-shaped when hidden or without a stamp", () => {
    renderSheet({ visible: false });
    expect(screen.queryByText("Session receipt")).toBeNull();

    renderSheet({ stamp: null });
    expect(screen.queryByText("Completed")).toBeNull();
  });

  it("copy passes the legal-language sweep (no bet/wager/gamble/win)", () => {
    renderSheet({ byCategory: { social: 2 } });
    expect(screen.queryByText(/\b(bet|wager|gamble|win)\b/i)).toBeNull();
  });
});
