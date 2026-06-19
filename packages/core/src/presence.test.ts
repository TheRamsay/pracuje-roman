import { describe, expect, it } from "vitest";
import {
  derivePresenceState,
  diffGameSessions,
  isWithinWorkHours,
  isWowActivityName,
  shouldSayRomanWorks
} from "./presence.js";

describe("isWowActivityName", () => {
  it("matches full world of warcraft titles", () => {
    expect(isWowActivityName("World of Warcraft")).toBe(true);
    expect(isWowActivityName("World of Warcraft Classic")).toBe(true);
  });

  it("matches standalone wow but not unrelated words", () => {
    expect(isWowActivityName("WoW")).toBe(true);
    expect(isWowActivityName("Playing wow hardcore")).toBe(true);
    expect(isWowActivityName("powwow simulator")).toBe(false);
  });
});

describe("derivePresenceState", () => {
  it("selects the playing activity and marks wow", () => {
    const state = derivePresenceState({
      discordUserId: "123",
      observedAt: new Date("2026-06-19T10:00:00Z"),
      status: "online",
      activities: [
        { name: "Listening Party", type: "Listening" },
        { name: "World of Warcraft", type: "Playing", startedAt: new Date("2026-06-19T09:00:00Z") }
      ]
    });

    expect(state.currentActivity?.name).toBe("World of Warcraft");
    expect(state.isWow).toBe(true);
  });
});

describe("diffGameSessions", () => {
  it("starts a session when a game appears", () => {
    const transition = diffGameSessions({
      activeSession: null,
      currentActivity: {
        name: "World of Warcraft",
        type: "Playing",
        startedAt: new Date("2026-06-19T09:00:00Z"),
        lastObservedAt: new Date("2026-06-19T10:00:00Z")
      }
    });

    expect(transition.shouldStartSession?.gameName).toBe("World of Warcraft");
    expect(transition.shouldCloseSessionId).toBeNull();
  });

  it("closes and restarts when the game changes", () => {
    const transition = diffGameSessions({
      activeSession: {
        id: "session-1",
        gameName: "World of Warcraft",
        startedAt: new Date("2026-06-19T09:00:00Z"),
        lastObservedAt: new Date("2026-06-19T10:05:00Z"),
        isActive: true
      },
      currentActivity: {
        name: "Counter-Strike 2",
        type: "Playing",
        startedAt: null,
        lastObservedAt: new Date("2026-06-19T10:10:00Z")
      }
    });

    expect(transition.shouldCloseSessionId).toBe("session-1");
    expect(transition.shouldStartSession?.gameName).toBe("Counter-Strike 2");
  });
});

describe("work hours helpers", () => {
  it("detects Prague weekday work hours", () => {
    expect(isWithinWorkHours(new Date("2026-06-19T08:00:00.000Z"), "Europe/Prague")).toBe(true);
    expect(isWithinWorkHours(new Date("2026-06-20T08:00:00.000Z"), "Europe/Prague")).toBe(false);
  });

  it("says Roman works only during work hours without wow", () => {
    const now = new Date("2026-06-19T08:00:00.000Z");
    expect(shouldSayRomanWorks(now, "Europe/Prague", false)).toBe(true);
    expect(shouldSayRomanWorks(now, "Europe/Prague", true)).toBe(false);
  });
});
