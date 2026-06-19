export type ActivityInput = {
  name: string;
  type: string;
  startedAt?: Date | null;
};

export type PresenceInput = {
  discordUserId: string;
  observedAt: Date;
  status: string;
  activities: ActivityInput[];
};

export type GameActivity = {
  name: string;
  type: string;
  startedAt: Date | null;
  lastObservedAt: Date;
};

export type PresenceState = {
  discordUserId: string;
  observedAt: Date;
  status: string;
  isWow: boolean;
  currentActivity: GameActivity | null;
};

export type ActiveSessionShape = {
  id: string;
  gameName: string;
  startedAt: Date;
  lastObservedAt: Date;
  isActive: boolean;
};

export type SessionTransition = {
  shouldCloseSessionId: string | null;
  closeEndedAt: Date | null;
  shouldStartSession: {
    gameName: string;
    startedAt: Date;
    lastObservedAt: Date;
  } | null;
};

const STANDALONE_WOW_PATTERN = /\bwow\b/i;

export function normalizeActivityName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[^\w\s]/g, " ")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function isWowActivityName(name: string | null | undefined): boolean {
  if (!name) {
    return false;
  }

  const normalized = normalizeActivityName(name);
  return normalized.includes("world of warcraft") || STANDALONE_WOW_PATTERN.test(normalized);
}

export function isWithinWorkHours(date: Date, timeZone: string): boolean {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    hour12: false
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekday = values.weekday;
  const hour = Number(values.hour);

  return ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(weekday) && hour >= 9 && hour < 17;
}

export function shouldSayRomanWorks(date: Date, timeZone: string, isWowPlaying: boolean): boolean {
  return isWithinWorkHours(date, timeZone) && !isWowPlaying;
}

export function pickCurrentActivity(input: PresenceInput): GameActivity | null {
  const playing = input.activities.find((activity) => activity.type.toLowerCase() === "playing");

  if (!playing) {
    return null;
  }

  return {
    name: playing.name,
    type: playing.type,
    startedAt: playing.startedAt ?? null,
    lastObservedAt: input.observedAt
  };
}

export function derivePresenceState(input: PresenceInput): PresenceState {
  const currentActivity = pickCurrentActivity(input);

  return {
    discordUserId: input.discordUserId,
    observedAt: input.observedAt,
    status: input.status,
    currentActivity,
    isWow: isWowActivityName(currentActivity?.name)
  };
}

export function diffGameSessions(input: {
  activeSession: ActiveSessionShape | null;
  currentActivity: GameActivity | null;
}): SessionTransition {
  const { activeSession, currentActivity } = input;

  if (!activeSession && !currentActivity) {
    return {
      shouldCloseSessionId: null,
      closeEndedAt: null,
      shouldStartSession: null
    };
  }

  if (activeSession && !currentActivity) {
    return {
      shouldCloseSessionId: activeSession.id,
      closeEndedAt: activeSession.lastObservedAt,
      shouldStartSession: null
    };
  }

  if (!activeSession && currentActivity) {
    return {
      shouldCloseSessionId: null,
      closeEndedAt: null,
      shouldStartSession: {
        gameName: currentActivity.name,
        startedAt: currentActivity.startedAt ?? currentActivity.lastObservedAt,
        lastObservedAt: currentActivity.lastObservedAt
      }
    };
  }

  if (!activeSession || !currentActivity) {
    return {
      shouldCloseSessionId: null,
      closeEndedAt: null,
      shouldStartSession: null
    };
  }

  if (activeSession.gameName === currentActivity.name) {
    return {
      shouldCloseSessionId: null,
      closeEndedAt: null,
      shouldStartSession: null
    };
  }

  return {
    shouldCloseSessionId: activeSession.id,
    closeEndedAt: activeSession.lastObservedAt,
    shouldStartSession: {
      gameName: currentActivity.name,
      startedAt: currentActivity.startedAt ?? currentActivity.lastObservedAt,
      lastObservedAt: currentActivity.lastObservedAt
    }
  };
}

export function serializePresencePayload(payload: unknown): string {
  const seen = new WeakSet<object>();
  const plainPayload =
    payload && typeof payload === "object" && "toJSON" in payload && typeof payload.toJSON === "function"
      ? payload.toJSON()
      : payload;

  return JSON.stringify(plainPayload ?? null, (_key, value) => {
    if (value && typeof value === "object") {
      if (seen.has(value)) {
        return "[Circular]";
      }

      seen.add(value);
    }

    return value;
  });
}
