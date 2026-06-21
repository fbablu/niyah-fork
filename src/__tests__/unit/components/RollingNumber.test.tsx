import React from "react";
import { render, screen } from "@testing-library/react-native";
import { RollingNumber } from "../../../components/session/RollingNumber";

// The component is hidden from accessibility (the Dial's adjustable parent
// conveys the value), so queries opt into hidden elements. Each digit renders
// as its own 0–9 column, so a digit appears once per column; non-digit
// characters render as single static cells.
const HIDDEN = { includeHiddenElements: true } as const;

describe("RollingNumber", () => {
  it("renders the static currency symbol and digit columns", () => {
    render(<RollingNumber text="$12" rowHeight={56} />);
    expect(screen.getByText("$", HIDDEN)).toBeTruthy();
    expect(screen.getAllByText("1", HIDDEN).length).toBeGreaterThan(0);
    expect(screen.getAllByText("2", HIDDEN).length).toBeGreaterThan(0);
  });

  it("renders static letters alongside the digit column for word labels", () => {
    render(<RollingNumber text="3 people" rowHeight={56} />);
    expect(screen.getByText("l", HIDDEN)).toBeTruthy(); // unique letter in "people"
    expect(screen.getAllByText("3", HIDDEN).length).toBeGreaterThan(0);
  });

  it("re-renders cleanly when the value changes", () => {
    const { rerender } = render(<RollingNumber text="$5" rowHeight={56} />);
    rerender(<RollingNumber text="$8" rowHeight={56} />);
    expect(screen.getAllByText("8", HIDDEN).length).toBeGreaterThan(0);
  });
});
