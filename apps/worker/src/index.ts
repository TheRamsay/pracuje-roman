import {
  ActivityType,
  Client,
  Events,
  GatewayIntentBits,
  type GuildMember,
  type Presence
} from "discord.js";
import { and, desc, eq, isNull } from "drizzle-orm";
import {
  createDb,
  gameSessions,
  presenceObservations,
  type DbClient
} from "@pracuje-roman/db";
import {
  derivePresenceState,
  diffGameSessions,
  serializePresencePayload,
  type PresenceState
} from "@pracuje-roman/core";
import { loadEnv } from "./env.js";

const DB_RETRY_ATTEMPTS = 10;
const DB_RETRY_DELAY_MS = 5_000;

function idleUntilConfigured(missingKeys: string[]): void {
  console.warn(
    `[worker] missing required env vars: ${missingKeys.join(", ")}. ` +
      "Worker is idle until configuration is completed."
  );

  setInterval(() => undefined, 60_000);
}

const envResult = loadEnv();

if (!envResult.ok) {
  idleUntilConfigured(envResult.missingKeys);
} else {
  const env = envResult.env;

  type LatestState = {
    presence: Presence | null;
    state: PresenceState;
    capturedAt: Date;
  };

  const db = createDb(env.DATABASE_URL);
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildPresences]
  });

  let latestState: LatestState = {
    presence: null,
    state: derivePresenceState({
      activities: [],
      discordUserId: env.DISCORD_USER_ID,
      observedAt: new Date(),
      status: "offline"
    }),
    capturedAt: new Date()
  };

  let flushInFlight: Promise<void> | null = null;

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  function isRetryableDbError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const message = error.message.toUpperCase();

    return (
      message.includes("ETIMEDOUT") ||
      message.includes("ECONNREFUSED") ||
      message.includes("ENETUNREACH") ||
      message.includes("CONNECT")
    );
  }

  async function withDbRetry<T>(label: string, operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= DB_RETRY_ATTEMPTS; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (!isRetryableDbError(error) || attempt === DB_RETRY_ATTEMPTS) {
          throw error;
        }

        console.warn(
          `[worker] ${label} failed on attempt ${attempt}/${DB_RETRY_ATTEMPTS}. ` +
            `Retrying in ${DB_RETRY_DELAY_MS / 1000}s.`
        );
        await sleep(DB_RETRY_DELAY_MS);
      }
    }

    throw lastError;
  }

  function activityTypeToLabel(type: number): string {
    return ActivityType[type] ?? `unknown:${type}`;
  }

  function toStateFromPresence(presence: Presence | null, capturedAt = new Date()): PresenceState {
    const status = presence?.status ?? "offline";
    const activities =
      presence?.activities.map((activity) => ({
        name: activity.name,
        type: activityTypeToLabel(activity.type),
        startedAt: activity.timestamps?.start ? new Date(activity.timestamps.start) : null
      })) ?? [];

    return derivePresenceState({
      activities,
      discordUserId: env.DISCORD_USER_ID,
      observedAt: capturedAt,
      status
    });
  }

  async function upsertSessionState(database: DbClient, state: PresenceState): Promise<void> {
    const currentActivity = state.currentActivity;
    const activeSession = await database.query.gameSessions.findFirst({
      where: and(
        eq(gameSessions.discordUserId, env.DISCORD_USER_ID),
        eq(gameSessions.isActive, true)
      ),
      orderBy: [desc(gameSessions.startedAt)]
    });

  const transition = diffGameSessions({
    activeSession: activeSession
      ? {
          id: activeSession.id,
          gameName: activeSession.gameName,
          startedAt: activeSession.startedAt,
          lastObservedAt: activeSession.lastObservedAt,
          isActive: activeSession.isActive
        }
      : null,
    currentActivity
  });

  if (transition.shouldCloseSessionId) {
    const endedAt = transition.closeEndedAt ?? state.observedAt;
    const session = activeSession;
    const durationSeconds =
      session == null
        ? null
        : Math.max(0, Math.floor((endedAt.getTime() - session.startedAt.getTime()) / 1000));

    await database
      .update(gameSessions)
      .set({
        endedAt,
        isActive: false,
        lastObservedAt: endedAt,
        durationSeconds
      })
      .where(eq(gameSessions.id, transition.shouldCloseSessionId));
  }

  if (transition.shouldStartSession) {
    await database.insert(gameSessions).values({
      discordUserId: env.DISCORD_USER_ID,
      gameName: transition.shouldStartSession.gameName,
      startedAt: transition.shouldStartSession.startedAt,
      lastObservedAt: transition.shouldStartSession.lastObservedAt,
      isActive: true
    });
    return;
  }

  if (activeSession && currentActivity && activeSession.gameName === currentActivity.name) {
    await database
      .update(gameSessions)
      .set({
        lastObservedAt: currentActivity.lastObservedAt
      })
      .where(
        and(eq(gameSessions.id, activeSession.id), isNull(gameSessions.endedAt), eq(gameSessions.isActive, true))
      );
  }
  }

  async function persistSnapshot(snapshot: LatestState): Promise<void> {
    await withDbRetry("persist snapshot", async () => {
      await db.insert(presenceObservations).values({
        discordUserId: env.DISCORD_USER_ID,
        observedAt: snapshot.state.observedAt,
        status: snapshot.state.status,
        activityName: snapshot.state.currentActivity?.name ?? null,
        activityType: snapshot.state.currentActivity?.type ?? null,
        isWow: snapshot.state.isWow,
        activityStartedAt: snapshot.state.currentActivity?.startedAt ?? null,
        rawJson: serializePresencePayload(snapshot.presence)
      });

      await upsertSessionState(db, snapshot.state);
    });
  }

  async function flushLatestState(reason: string): Promise<void> {
    if (flushInFlight) {
      await flushInFlight;
      return;
    }

  const snapshot = {
    ...latestState,
    capturedAt: latestState.capturedAt,
    state: {
      ...latestState.state
    }
  };

  flushInFlight = (async () => {
    try {
      await persistSnapshot(snapshot);
      console.info(`[worker] persisted snapshot (${reason}) at ${snapshot.state.observedAt.toISOString()}`);
    } finally {
      flushInFlight = null;
    }
  })();

  await flushInFlight;
  }

  function updateLatestPresence(presence: Presence | null, capturedAt = new Date()): void {
    latestState = {
      presence,
      capturedAt,
      state: toStateFromPresence(presence, capturedAt)
    };
  }

  async function loadInitialPresence(member: GuildMember): Promise<void> {
    await member.fetch(true);
    updateLatestPresence(member.presence ?? null, new Date());
    await withDbRetry("load initial presence", async () => {
      await upsertSessionState(db, latestState.state);
    });
  }

  client.once(Events.ClientReady, async (readyClient) => {
    console.info(`[worker] logged in as ${readyClient.user.tag}`);
    try {
      const guild = await readyClient.guilds.fetch(env.DISCORD_GUILD_ID);
      const member = await guild.members.fetch(env.DISCORD_USER_ID);
      await loadInitialPresence(member);
      await flushLatestState("startup");
    } catch (error) {
      console.error("[worker] failed to load initial presence", error);
    }

    setInterval(() => {
      void flushLatestState("interval").catch((error) => {
        console.error("[worker] failed to flush interval snapshot", error);
      });
    }, env.SNAPSHOT_INTERVAL_MINUTES * 60_000);
  });

  client.on(Events.PresenceUpdate, async (_oldPresence, newPresence) => {
    if (newPresence.userId !== env.DISCORD_USER_ID) {
      return;
    }

    updateLatestPresence(newPresence, new Date());

    try {
      await withDbRetry("presence update", async () => {
        await upsertSessionState(db, latestState.state);
      });
    } catch (error) {
      console.error("[worker] failed to persist presence update", error);
    }
  });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      void (async () => {
        console.info(`[worker] received ${signal}, flushing latest snapshot`);
        try {
          await flushLatestState(signal);
        } finally {
          client.destroy();
          process.exit(0);
        }
      })();
    });
  }

  await client.login(env.DISCORD_BOT_TOKEN);
}
