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

function getRequiredEnv() {
  const databaseUrl = process.env.DATABASE_URL;
  const discordUserId = process.env.DISCORD_USER_ID;
  const timeZone = process.env.TZ ?? "Europe/Prague";

  if (!databaseUrl || !discordUserId) {
    return null;
  }

  return { databaseUrl, discordUserId, timeZone };
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
}
