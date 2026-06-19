import { boolean, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const presenceObservations = pgTable(
  "presence_observations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    discordUserId: text("discord_user_id").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    status: text("status").notNull(),
    activityName: text("activity_name"),
    activityType: text("activity_type"),
    isWow: boolean("is_wow").notNull().default(false),
    activityStartedAt: timestamp("activity_started_at", { withTimezone: true }),
    rawJson: text("raw_json").notNull()
  },
  (table) => ({
    observedAtIdx: index("presence_observations_observed_at_idx").on(table.observedAt),
    discordUserObservedAtIdx: index("presence_observations_user_observed_at_idx").on(
      table.discordUserId,
      table.observedAt
    )
  })
);

export const gameSessions = pgTable(
  "game_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    discordUserId: text("discord_user_id").notNull(),
    gameName: text("game_name").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    lastObservedAt: timestamp("last_observed_at", { withTimezone: true }).notNull(),
    durationSeconds: integer("duration_seconds")
  },
  (table) => ({
    activeSessionIdx: index("game_sessions_active_idx").on(table.discordUserId, table.isActive),
    startedAtIdx: index("game_sessions_started_at_idx").on(table.startedAt)
  })
);
