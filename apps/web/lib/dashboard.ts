import { desc, eq } from "drizzle-orm";
import { isWowActivityName, shouldSayRomanWorks } from "@pracuje-roman/core";
import { createDb, gameSessions, presenceObservations } from "@pracuje-roman/db";

export type LatestObservation = {
  observedAt: string;
  activityName: string | null;
  isWow: boolean;
  status: string;
};

export type RecentWowSession = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
};

export type DashboardData = {
  worksNow: boolean;
  latestObservation: LatestObservation | null;
  recentWowSessions: RecentWowSession[];
};

const DB_RETRY_ATTEMPTS = 6;
const DB_RETRY_DELAY_MS = 3_000;

function getRequiredEnv() {
  const databaseUrl = process.env.DATABASE_URL;
  const discordUserId = process.env.DISCORD_USER_ID;
  const timeZone = process.env.TZ ?? "Europe/Prague";

  if (!databaseUrl || !discordUserId) {
    return null;
  }

  return { databaseUrl, discordUserId, timeZone };
}

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

export async function getDashboardData(): Promise<DashboardData> {
  const env = getRequiredEnv();

  if (!env) {
    return {
      worksNow: false,
      latestObservation: null,
      recentWowSessions: []
    };
  }

  const db = createDb(env.databaseUrl);

  for (let attempt = 1; attempt <= DB_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const [latestObservationRow] = await db
        .select()
        .from(presenceObservations)
        .where(eq(presenceObservations.discordUserId, env.discordUserId))
        .orderBy(desc(presenceObservations.observedAt))
        .limit(1);

      const latestObservation = latestObservationRow
        ? {
            observedAt: latestObservationRow.observedAt.toISOString(),
            activityName: latestObservationRow.activityName,
            isWow: latestObservationRow.isWow,
            status: latestObservationRow.status
          }
        : null;

      const sessions = await db
        .select()
        .from(gameSessions)
        .where(eq(gameSessions.discordUserId, env.discordUserId))
        .orderBy(desc(gameSessions.startedAt))
        .limit(30);

      const recentWowSessions = sessions
        .filter((session) => isWowActivityName(session.gameName))
        .map((session) => ({
          id: session.id,
          startedAt: session.startedAt.toISOString(),
          endedAt: session.endedAt ? session.endedAt.toISOString() : null,
          durationSeconds:
            session.durationSeconds ??
            (session.endedAt
              ? Math.max(0, Math.floor((session.endedAt.getTime() - session.startedAt.getTime()) / 1000))
              : null)
        }));

      return {
        worksNow: shouldSayRomanWorks(new Date(), env.timeZone, latestObservation?.isWow ?? false),
        latestObservation,
        recentWowSessions
      };
    } catch (error) {
      if (!isRetryableDbError(error) || attempt === DB_RETRY_ATTEMPTS) {
        throw error;
      }

      console.warn(
        `[web] dashboard query failed on attempt ${attempt}/${DB_RETRY_ATTEMPTS}. ` +
          `Retrying in ${DB_RETRY_DELAY_MS / 1000}s.`
      );
      await sleep(DB_RETRY_DELAY_MS);
    }
  }

  return {
    worksNow: false,
    latestObservation: null,
    recentWowSessions: []
  };
}
