/**
 * Unit Tests for LegalAcceptanceOverlay component
 *
 * Two affirmations gate Continue: an explicit 18+ age attestation and
 * Terms/Privacy agreement. Tests cover rendering, the both-required gate,
 * and the loading state.
 */

import React from "react";
import { Linking } from "react-native";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { LegalAcceptanceOverlay } from "../../../components/LegalAcceptanceOverlay";

const AGE_LABEL = "I confirm I am 18 years of age or older";
const TERMS_LABEL = "I agree to the Terms of Service and Privacy Policy";

describe("LegalAcceptanceOverlay", () => {
  it("renders both attestations when visible", () => {
    render(<LegalAcceptanceOverlay visible={true} onAccept={jest.fn()} />);

    expect(screen.getByText("Terms & Privacy")).toBeTruthy();
    expect(
      screen.getByText("Please review and accept to continue"),
    ).toBeTruthy();
    expect(screen.getByText(AGE_LABEL)).toBeTruthy();
    expect(screen.getByText(TERMS_LABEL)).toBeTruthy();
    expect(screen.getByText("Continue")).toBeTruthy();
  });

  it("both checkboxes start unchecked", () => {
    render(<LegalAcceptanceOverlay visible={true} onAccept={jest.fn()} />);

    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(2);
    boxes.forEach((b) =>
      expect(b.props.accessibilityState.checked).toBe(false),
    );
  });

  it("Continue does nothing when nothing is checked", () => {
    const onAccept = jest.fn();
    render(<LegalAcceptanceOverlay visible={true} onAccept={onAccept} />);

    fireEvent.press(screen.getByText("Continue"));
    expect(onAccept).not.toHaveBeenCalled();
  });

  it("Continue stays disabled when only the 18+ box is checked", () => {
    const onAccept = jest.fn();
    render(<LegalAcceptanceOverlay visible={true} onAccept={onAccept} />);

    fireEvent.press(screen.getByLabelText(AGE_LABEL));
    fireEvent.press(screen.getByText("Continue"));
    expect(onAccept).not.toHaveBeenCalled();
  });

  it("Continue stays disabled when only the terms box is checked", () => {
    const onAccept = jest.fn();
    render(<LegalAcceptanceOverlay visible={true} onAccept={onAccept} />);

    fireEvent.press(screen.getByLabelText(TERMS_LABEL));
    fireEvent.press(screen.getByText("Continue"));
    expect(onAccept).not.toHaveBeenCalled();
  });

  it("ticking BOTH boxes enables Continue and calls onAccept once", () => {
    const onAccept = jest.fn();
    render(<LegalAcceptanceOverlay visible={true} onAccept={onAccept} />);

    const age = screen.getByLabelText(AGE_LABEL);
    const terms = screen.getByLabelText(TERMS_LABEL);

    fireEvent.press(age);
    fireEvent.press(terms);
    expect(age.props.accessibilityState.checked).toBe(true);
    expect(terms.props.accessibilityState.checked).toBe(true);

    fireEvent.press(screen.getByText("Continue"));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it("keeps the header visible in the loading state", () => {
    render(
      <LegalAcceptanceOverlay
        visible={true}
        onAccept={jest.fn()}
        loading={true}
      />,
    );

    // Button shows a spinner instead of "Continue" while loading; header stays.
    expect(screen.getByText("Terms & Privacy")).toBeTruthy();
  });

  it("does not call onAccept when loading even if both boxes are checked", () => {
    const onAccept = jest.fn();
    render(
      <LegalAcceptanceOverlay
        visible={true}
        onAccept={onAccept}
        loading={true}
      />,
    );

    fireEvent.press(screen.getByLabelText(AGE_LABEL));
    fireEvent.press(screen.getByLabelText(TERMS_LABEL));
    expect(onAccept).not.toHaveBeenCalled();
  });

  it("opens the hosted full Terms + Privacy pages from the Read full links", () => {
    const openURL = jest
      .spyOn(Linking, "openURL")
      .mockResolvedValue(undefined as never);
    render(<LegalAcceptanceOverlay visible={true} onAccept={jest.fn()} />);

    fireEvent.press(screen.getByLabelText("Read full Terms of Service"));
    fireEvent.press(screen.getByLabelText("Read full Privacy Policy"));

    expect(openURL).toHaveBeenCalledWith("https://niyah.live/legal/terms");
    expect(openURL).toHaveBeenCalledWith("https://niyah.live/legal/privacy");
    openURL.mockRestore();
  });

  it("the Read full links are not checkboxes (only two checkboxes gate Continue)", () => {
    render(<LegalAcceptanceOverlay visible={true} onAccept={jest.fn()} />);
    // Redesign added external links; the acceptance gate must still be exactly
    // the two attestation checkboxes, not the links.
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    expect(screen.getByText("Read full Terms ↗")).toBeTruthy();
    expect(screen.getByText("Read full Privacy Policy ↗")).toBeTruthy();
  });
});
