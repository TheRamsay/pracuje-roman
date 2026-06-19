# Discord Presence Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Railway-hosted app that logs Roman's Discord presence/activity into Postgres and shows a dashboard whose main answer is `Pracuje Roman?`, plus a list of recent WoW sessions grouped by day.

**Architecture:** Use a small npm workspaces monorepo with two apps: `apps/web` for the Next.js dashboard and `apps/worker` for the long-running `discord.js` gateway listener. The worker listens to real-time Discord presence updates, keeps the latest state in memory, and persists snapshots to Postgres on a configurable interval from `.env`, while also maintaining WoW session rows; the web app reads directly from Postgres through Next.js server components and renders a Tailwind-styled dashboard with a hero status card and recent WoW history.

**Tech Stack:** TypeScript, npm workspaces, Next.js App Router, Tailwind CSS, `discord.js`, Postgres, Drizzle ORM, Vitest, Railway

---

## File Structure

- `package.json` — root workspace config and shared scripts
- `tsconfig.base.json` — shared TypeScript settings for all packages
- `apps/web/package.json` — Next.js app dependencies and scripts
- `apps/web/next.config.ts` — minimal Next.js config
- `apps/web/app/page.tsx` — single dashboard page
- `apps/web/app/globals.css` — Tailwind imports and global tokens
- `apps/web/app/layout.tsx` — root layout
- `apps/web/lib/dashboard.ts` — server-side query helpers for dashboard data
- `apps/web/components/hero-status.tsx` — top-of-page `Pracuje Roman?` banner
- `apps/web/components/session-list.tsx` — recent WoW sessions grouped by day
- `apps/worker/package.json` — worker dependencies and scripts
- `apps/worker/src/index.ts` — Discord gateway bootstrap and event handlers
- `apps/worker/src/env.ts` — worker env validation
- `packages/db/package.json` — shared database package
- `packages/db/src/schema.ts` — Drizzle tables for observations and sessions
- `packages/db/src/client.ts` — shared Postgres client factory
- `packages/db/drizzle.config.ts` — migration config
- `packages/db/migrations/*` — generated SQL migrations
- `packages/core/package.json` — shared pure logic package
- `packages/core/src/presence.ts` — activity parsing, WoW detection, session transition logic, work-hours helpers, hero decision rules
- `packages/core/src/presence.test.ts` — unit tests for pure logic
- `.env.example` — required environment variables for both services
- `railway.json` — shared Railway build/deploy defaults where useful
- `README.md` — local run and deploy instructions

### Task 1: Bootstrap the Monorepo

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `README.md`
- Create: `apps/web/package.json`
- Create: `apps/worker/package.json`
- Create: `packages/core/package.json`
- Create: `packages/db/package.json`

- [ ] **Step 1: Create the root workspace manifest**

```json
{
  "name": "discord-presence-dashboard",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "build": "npm run build --workspaces",
    "dev:web": "npm run dev --workspace web",
    "dev:worker": "npm run dev --workspace worker",
    "test": "npm run test --workspaces --if-present",
    "db:generate": "npm run db:generate --workspace @app/db",
    "db:migrate": "npm run db:migrate --workspace @app/db"
  }
}
```

- [ ] **Step 2: Add shared TypeScript config and ignore rules**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": {
      "@app/core/*": ["packages/core/src/*"],
      "@app/db/*": ["packages/db/src/*"]
    }
  }
}
```

```gitignore
node_modules
.next
dist
.env
.env.local
coverage
apps/**/.next
packages/db/migrations/meta
```

- [ ] **Step 3: Add env template and workspace package manifests**

```env
DATABASE_URL=
DISCORD_BOT_TOKEN=
DISCORD_GUILD_ID=
DISCORD_USER_ID=
SNAPSHOT_INTERVAL_MINUTES=5
TZ=Europe/Prague
```

```json
{
  "name": "web",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  }
}
```

```json
{
  "name": "worker",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js"
  }
}
```

- [ ] **Step 4: Install base dependencies**

Run: `npm install next react react-dom discord.js drizzle-orm postgres zod`  
Run: `npm install -D typescript tsx vitest @types/node drizzle-kit`

Expected: install completes with a generated `package-lock.json` and no missing peer dependency errors.

- [ ] **Step 5: Initialize git and make the bootstrap commit**

Run: `git init`  
Run: `git add package.json package-lock.json tsconfig.base.json .gitignore .env.example README.md apps packages`  
Run: `git commit -m "chore: bootstrap monorepo"`

Expected: `git status --short` prints nothing.

### Task 2: Add the Shared Database Package and First Migration

**Files:**
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/src/schema.ts`
- Create: `packages/db/src/client.ts`
- Create: `packages/db/src/index.ts`
- Create: `packages/db/drizzle.config.ts`
- Create: `packages/db/migrations/0000_initial.sql`

- [ ] **Step 1: Write the table definitions**

```ts
import { boolean, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const presenceObservations = pgTable("presence_observations", {
  id: uuid("id").defaultRandom().primaryKey(),
  discordUserId: text("discord_user_id").notNull(),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
  status: text("status").notNull(),
  activityName: text("activity_name"),
  activityType: text("activity_type"),
  isWow: boolean("is_wow").notNull().default(false),
  activityStartedAt: timestamp("activity_started_at", { withTimezone: true }),
  rawJson: text("raw_json").notNull()
}, (table) => ({
  observedAtIdx: index("presence_observations_observed_at_idx").on(table.observedAt),
  discordUserObservedAtIdx: index("presence_observations_user_observed_at_idx").on(table.discordUserId, table.observedAt)
}));

export const gameSessions = pgTable("game_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  discordUserId: text("discord_user_id").notNull(),
  gameName: text("game_name").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  lastObservedAt: timestamp("last_observed_at", { withTimezone: true }).notNull(),
  durationSeconds: integer("duration_seconds")
}, (table) => ({
  activeSessionIdx: index("game_sessions_active_idx").on(table.discordUserId, table.isActive),
  startedAtIdx: index("game_sessions_started_at_idx").on(table.startedAt)
}));
```

- [ ] **Step 2: Add the database client and exports**

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function createDb(databaseUrl: string) {
  const client = postgres(databaseUrl, { prepare: false });
  return drizzle(client, { schema });
}
```

```ts
export * from "./client";
export * from "./schema";
```

- [ ] **Step 3: Add the Drizzle config and initial SQL migration**

```ts
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? ""
  }
} satisfies Config;
```

```sql
CREATE TABLE "presence_observations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "discord_user_id" text NOT NULL,
  "observed_at" timestamptz NOT NULL,
  "status" text NOT NULL,
  "activity_name" text,
  "activity_type" text,
  "is_wow" boolean NOT NULL DEFAULT false,
  "activity_started_at" timestamptz,
  "raw_json" text NOT NULL
);

CREATE TABLE "game_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "discord_user_id" text NOT NULL,
  "game_name" text NOT NULL,
  "started_at" timestamptz NOT NULL,
  "ended_at" timestamptz,
  "is_active" boolean NOT NULL DEFAULT true,
  "last_observed_at" timestamptz NOT NULL,
  "duration_seconds" integer
);

CREATE INDEX "presence_observations_observed_at_idx" ON "presence_observations" ("observed_at");
CREATE INDEX "presence_observations_user_observed_at_idx" ON "presence_observations" ("discord_user_id", "observed_at");
CREATE INDEX "game_sessions_active_idx" ON "game_sessions" ("discord_user_id", "is_active");
CREATE INDEX "game_sessions_started_at_idx" ON "game_sessions" ("started_at");
```

- [ ] **Step 4: Verify the migration package**

Run: `npm run db:generate`  
Expected: Drizzle either confirms the checked-in migration matches schema or creates only metadata changes you review before committing.

- [ ] **Step 5: Commit the DB package**

Run: `git add packages/db`  
Run: `git commit -m "feat: add postgres schema and drizzle config"`

### Task 3: Implement and Test Pure Presence Logic

**Files:**
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/presence.ts`
- Create: `packages/core/src/index.ts`
- Create: `packages/core/src/presence.test.ts`

- [ ] **Step 1: Write failing tests for activity extraction and work-hours status**

```ts
import { describe, expect, it } from "vitest";
import { getPrimaryGameActivity, isWithinWorkHours, shouldSayRomanWorks } from "./presence";

describe("getPrimaryGameActivity", () => {
  it("returns the playing activity when present", () => {
    const result = getPrimaryGameActivity([
      { type: 2, name: "Spotify" },
      { type: 0, name: "World of Warcraft" }
    ]);

    expect(result?.name).toBe("World of Warcraft");
  });
});

describe("isWithinWorkHours", () => {
  it("returns true for a Prague weekday at 10:00", () => {
    expect(isWithinWorkHours(new Date("2026-06-19T08:00:00.000Z"), "Europe/Prague")).toBe(true);
  });

  it("returns false for a Prague Saturday at 10:00", () => {
    expect(isWithinWorkHours(new Date("2026-06-20T08:00:00.000Z"), "Europe/Prague")).toBe(false);
  });
});

describe("shouldSayRomanWorks", () => {
  it("returns true only during weekday work hours when wow is not active", () => {
    const now = new Date("2026-06-19T08:00:00.000Z");
    expect(shouldSayRomanWorks(now, "Europe/Prague", false)).toBe(true);
    expect(shouldSayRomanWorks(now, "Europe/Prague", true)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/core/src/presence.test.ts`  
Expected: FAIL with module or export errors because `presence.ts` is not implemented yet.

- [ ] **Step 3: Implement the pure logic**

```ts
export type MinimalActivity = {
  type: number;
  name: string;
  createdAt?: Date;
};

export function getPrimaryGameActivity(activities: MinimalActivity[]) {
  return activities.find((activity) => activity.type === 0) ?? null;
}

export function isWithinWorkHours(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    hour12: false
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  );

  const weekday = parts.weekday;
  const hour = Number(parts.hour);

  return ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(weekday) && hour >= 9 && hour < 17;
}

export function isWowActivity(activityName: string | null) {
  if (!activityName) return false;
  return activityName.toLowerCase().includes("world of warcraft") || activityName.toLowerCase().includes("wow");
}

export function shouldSayRomanWorks(date: Date, timeZone: string, isWowPlaying: boolean) {
  return isWithinWorkHours(date, timeZone) && !isWowPlaying;
}
```

- [ ] **Step 4: Add session transition tests before implementing session helpers**

```ts
import { describe, expect, it } from "vitest";
import { buildSessionTransition } from "./presence";

describe("buildSessionTransition", () => {
  it("starts a new session when a game appears", () => {
    const now = new Date("2026-06-19T12:00:00.000Z");
    const result = buildSessionTransition(null, "World of Warcraft", now);

    expect(result.action).toBe("start");
    expect(result.next?.gameName).toBe("World of Warcraft");
  });

  it("closes the previous session when the game changes", () => {
    const now = new Date("2026-06-19T13:00:00.000Z");
    const active = {
      gameName: "Diablo IV",
      startedAt: new Date("2026-06-19T12:00:00.000Z"),
      lastObservedAt: new Date("2026-06-19T12:50:00.000Z")
    };
    const result = buildSessionTransition(active, "World of Warcraft", now);

    expect(result.action).toBe("switch");
    expect(result.closed?.durationSeconds).toBe(3600);
    expect(result.next?.gameName).toBe("World of Warcraft");
  });
});
```

- [ ] **Step 5: Implement session transition logic and rerun tests**

```ts
type ActiveSession = {
  gameName: string;
  startedAt: Date;
  lastObservedAt: Date;
};

export function buildSessionTransition(active: ActiveSession | null, nextGameName: string | null, observedAt: Date) {
  if (!active && !nextGameName) {
    return { action: "noop" as const, closed: null, next: null };
  }

  if (!active && nextGameName) {
    return {
      action: "start" as const,
      closed: null,
      next: { gameName: nextGameName, startedAt: observedAt, lastObservedAt: observedAt }
    };
  }

  if (active && !nextGameName) {
    return {
      action: "stop" as const,
      closed: {
        ...active,
        endedAt: observedAt,
        durationSeconds: Math.floor((observedAt.getTime() - active.startedAt.getTime()) / 1000)
      },
      next: null
    };
  }

  if (active!.gameName === nextGameName) {
    return {
      action: "keep" as const,
      closed: null,
      next: { ...active!, lastObservedAt: observedAt }
    };
  }

  return {
    action: "switch" as const,
    closed: {
      ...active!,
      endedAt: observedAt,
      durationSeconds: Math.floor((observedAt.getTime() - active!.startedAt.getTime()) / 1000)
    },
    next: { gameName: nextGameName!, startedAt: observedAt, lastObservedAt: observedAt }
  };
}
```

Run: `npx vitest run packages/core/src/presence.test.ts`  
Expected: PASS with all tests green.

- [ ] **Step 6: Commit the shared logic**

Run: `git add packages/core`  
Run: `git commit -m "feat: add presence parsing and session helpers"`

### Task 4: Build the Discord Worker

**Files:**
- Create: `apps/worker/tsconfig.json`
- Create: `apps/worker/src/env.ts`
- Create: `apps/worker/src/index.ts`

- [ ] **Step 1: Add env parsing for the worker**

```ts
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DISCORD_BOT_TOKEN: z.string().min(1),
  DISCORD_GUILD_ID: z.string().min(1),
  DISCORD_USER_ID: z.string().min(1),
  SNAPSHOT_INTERVAL_MINUTES: z.coerce.number().int().min(1).max(60)
});

export const env = envSchema.parse(process.env);
```

- [ ] **Step 2: Implement the gateway bootstrap**

```ts
import { Client, Events, GatewayIntentBits } from "discord.js";
import { eq, and, desc } from "drizzle-orm";
import { getPrimaryGameActivity, buildSessionTransition, isWowActivity } from "@app/core/presence";
import { createDb, gameSessions, presenceObservations } from "@app/db";
import { env } from "./env";

const db = createDb(env.DATABASE_URL);
let latestPresencePayload: {
  status: string;
  activityName: string | null;
  activityType: string | null;
  activityStartedAt: Date | null;
  rawJson: string;
} | null = null;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildPresences]
});

client.once(Events.ClientReady, async () => {
  console.log(`worker ready as ${client.user?.tag}`);
  const guild = await client.guilds.fetch(env.DISCORD_GUILD_ID);
  await guild.members.fetch(env.DISCORD_USER_ID);
});

client.on(Events.PresenceUpdate, async (_, nextPresence) => {
  if (!nextPresence || nextPresence.userId !== env.DISCORD_USER_ID) return;

  const observedAt = new Date();
  const game = getPrimaryGameActivity(
    nextPresence.activities.map((activity) => ({
      type: activity.type,
      name: activity.name,
      createdAt: activity.createdAt ?? undefined
    }))
  );

  latestPresencePayload = {
    status: nextPresence.status,
    activityName: game?.name ?? null,
    activityType: game ? String(game.type) : null,
    activityStartedAt: game?.createdAt ?? null,
    rawJson: JSON.stringify(nextPresence.toJSON())
  };

  const activeSession = await db.query.gameSessions.findFirst({
    where: and(eq(gameSessions.discordUserId, env.DISCORD_USER_ID), eq(gameSessions.isActive, true)),
    orderBy: [desc(gameSessions.startedAt)]
  });

  const transition = buildSessionTransition(
    activeSession
      ? {
          gameName: activeSession.gameName,
          startedAt: activeSession.startedAt,
          lastObservedAt: activeSession.lastObservedAt
        }
      : null,
    game?.name ?? null,
    observedAt
  );

  if (transition.closed && activeSession) {
    await db
      .update(gameSessions)
      .set({
        endedAt: transition.closed.endedAt,
        durationSeconds: transition.closed.durationSeconds,
        lastObservedAt: observedAt,
        isActive: false
      })
      .where(eq(gameSessions.id, activeSession.id));
  }

  if (transition.next && ["start", "switch"].includes(transition.action)) {
    await db.insert(gameSessions).values({
      discordUserId: env.DISCORD_USER_ID,
      gameName: transition.next.gameName,
      startedAt: transition.next.startedAt,
      lastObservedAt: transition.next.lastObservedAt,
      isActive: true
    });
  }

  if (transition.action === "keep" && activeSession) {
    await db
      .update(gameSessions)
      .set({ lastObservedAt: observedAt })
      .where(eq(gameSessions.id, activeSession.id));
  }
});

setInterval(async () => {
  if (!latestPresencePayload) return;

  await db.insert(presenceObservations).values({
    discordUserId: env.DISCORD_USER_ID,
    observedAt: new Date(),
    status: latestPresencePayload.status,
    activityName: latestPresencePayload.activityName,
    activityType: latestPresencePayload.activityType,
    isWow: isWowActivity(latestPresencePayload.activityName),
    activityStartedAt: latestPresencePayload.activityStartedAt,
    rawJson: latestPresencePayload.rawJson
  });
}, env.SNAPSHOT_INTERVAL_MINUTES * 60 * 1000);

await client.login(env.DISCORD_BOT_TOKEN);
```

- [ ] **Step 3: Run the worker locally against a dev database**

Run: `npm run db:migrate`  
Run: `npm run dev:worker`

Expected: console logs `worker ready as ...` and then idles waiting for presence updates without exiting.

- [ ] **Step 4: Commit the worker**

Run: `git add apps/worker`  
Run: `git commit -m "feat: add discord presence worker"`

### Task 5: Build the Dashboard Data Access and Page

**Files:**
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/globals.css`
- Create: `apps/web/app/page.tsx`
- Create: `apps/web/lib/dashboard.ts`
- Create: `apps/web/components/hero-status.tsx`
- Create: `apps/web/components/session-list.tsx`

- [ ] **Step 1: Add a failing dashboard data test as a plain unit around shape formatting**

```ts
import { describe, expect, it } from "vitest";
import { formatDuration } from "./dashboard";

describe("formatDuration", () => {
  it("formats seconds as h m", () => {
    expect(formatDuration(3660)).toBe("1h 1m");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run apps/web/lib/dashboard.test.ts`  
Expected: FAIL because `dashboard.ts` and export do not exist yet.

- [ ] **Step 3: Implement dashboard queries and helpers**

```ts
import { and, desc, eq, gte } from "drizzle-orm";
import { createDb, gameSessions, presenceObservations } from "@app/db";
import { shouldSayRomanWorks } from "@app/core/presence";

const db = createDb(process.env.DATABASE_URL!);
const timeZone = process.env.TZ ?? "Europe/Prague";
const discordUserId = process.env.DISCORD_USER_ID!;

export function formatDuration(totalSeconds: number | null) {
  if (!totalSeconds) return "0m";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export async function getDashboardData() {
  const [latestObservation] = await db
    .select()
    .from(presenceObservations)
    .where(eq(presenceObservations.discordUserId, discordUserId))
    .orderBy(desc(presenceObservations.observedAt))
    .limit(1);

  const [activeSession] = await db
    .select()
    .from(gameSessions)
    .where(eq(gameSessions.isActive, true))
    .orderBy(desc(gameSessions.startedAt))
    .limit(1);

  const [lastFinishedSession] = await db
    .select()
    .from(gameSessions)
    .where(eq(gameSessions.isActive, false))
    .orderBy(desc(gameSessions.endedAt))
    .limit(1);

  const recentWowSessions = await db
    .select()
    .from(gameSessions)
    .where(
      and(
        eq(gameSessions.discordUserId, discordUserId),
        eq(gameSessions.gameName, "World of Warcraft"),
        gte(gameSessions.startedAt, new Date(Date.now() - 14 * 24 * 60 * 60 * 1000))
      )
    )
    .orderBy(desc(gameSessions.startedAt))
    .limit(20);

  const isWowPlaying = latestObservation?.isWow ?? false;
  const worksNow = shouldSayRomanWorks(new Date(), timeZone, isWowPlaying);

  return {
    now: new Date(),
    worksNow,
    latestObservation,
    activeSession,
    lastFinishedSession,
    recentWowSessions
  };
}
```

- [ ] **Step 4: Implement the page and layout**

```tsx
import "./globals.css";
import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="cs">
      <body>{children}</body>
    </html>
  );
}
```

```tsx
import { getDashboardData } from "../lib/dashboard";
import { HeroStatus } from "../components/hero-status";
import { SessionList } from "../components/session-list";

export default async function Page() {
  const data = await getDashboardData();

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
      <HeroStatus
        worksNow={data.worksNow}
        isWowPlaying={data.latestObservation?.isWow ?? false}
        activityName={data.latestObservation?.activityName ?? null}
      />
      <SessionList sessions={data.recentWowSessions} />
    </main>
  );
}
```

- [ ] **Step 5: Add minimal CSS and rerun tests**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-zinc-950 text-zinc-50 antialiased;
}
```

Run: `npx vitest run apps/web/lib/dashboard.test.ts`  
Run: `npm run build --workspace web`

Expected: test passes and Next.js build finishes successfully.

- [ ] **Step 6: Commit the web app**

Run: `git add apps/web`  
Run: `git commit -m "feat: add dashboard web app"`

### Task 6: Add Railway Configuration and Runbook

**Files:**
- Create: `railway.json`
- Modify: `README.md`

- [ ] **Step 1: Add a small Railway config**

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "deploy": {
    "restartPolicyType": "on_failure",
    "restartPolicyMaxRetries": 10
  }
}
```

- [ ] **Step 2: Document service setup and env vars in README**

```md
# Discord Presence Dashboard

## Services

- `web`: Next.js dashboard
- `worker`: long-running Discord gateway listener
- `postgres`: Railway PostgreSQL

## Local setup

1. `cp .env.example .env`
2. `npm install`
3. `npm run db:migrate`
4. `npm run dev:web`
5. `npm run dev:worker`

## Railway deploy

1. Create one Railway project.
2. Add a PostgreSQL service.
3. Add a service from this repo with root directory `apps/web`.
4. Add a second service from this repo with root directory `apps/worker`.
5. Set these variables on both services:
   - `DATABASE_URL`
   - `DISCORD_USER_ID`
   - `SNAPSHOT_INTERVAL_MINUTES=5`
   - `TZ=Europe/Prague`
6. Set worker-only variables:
   - `DISCORD_BOT_TOKEN`
   - `DISCORD_GUILD_ID`
7. Run migrations once with `npm run db:migrate`.
```

- [ ] **Step 3: Verify the full stack locally**

Run: `npm run test`  
Run: `npm run build`

Expected: all tests pass and both workspaces build without TypeScript errors.

- [ ] **Step 4: Commit the deployment docs**

Run: `git add railway.json README.md`  
Run: `git commit -m "docs: add railway deployment runbook"`

## Self-Review

- Spec coverage: the plan covers the chosen stack (`discord.js`, `Next.js`, `Postgres`, `Railway`), the logging worker, the dashboard, session history, and weekday work-hours classification.
- Placeholder scan: no `TODO`, `TBD`, or undefined “handle appropriately” steps remain.
- Type consistency: all shared imports point to `@app/core` and `@app/db`; worker session transitions use the same `buildSessionTransition` contract tested in `packages/core`.
