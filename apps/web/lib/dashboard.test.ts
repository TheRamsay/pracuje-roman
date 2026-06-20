import { describe, expect, it } from "vitest";
import { formatDuration } from "./format";

describe("formatDuration", () => {
  it("formats mixed hours and minutes", () => {
    expect(formatDuration(3660)).toBe("1h 1m");
  });

  it("formats exact hours without trailing minutes", () => {
    expect(formatDuration(7200)).toBe("2h");
  });

  it("falls back to 0m for nullish values and shows sub-minute durations", () => {
    expect(formatDuration(null)).toBe("0m");
    expect(formatDuration(42)).toBe("<1m");
  });
});
