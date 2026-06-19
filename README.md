# Pracuje Roman

Railway monorepo for tracking a Discord user's presence, persisting interval snapshots to Postgres, and exposing that data to the dashboard app.

## Workspace Layout

- `apps/web` - Next.js dashboard
- `apps/worker` - long-running Discord gateway worker
- `packages/core` - pure presence parsing and session transition logic
- `packages/db` - Drizzle schema, Postgres client, and migrations

## Required Environment

Copy `.env.example` into your runtime environment and provide:

- `DATABASE_URL`
- `DISCORD_BOT_TOKEN`
- `DISCORD_GUILD_ID`
- `DISCORD_USER_ID`
- `SNAPSHOT_INTERVAL_MINUTES`
- `TZ`

## Local Commands

```bash
npm install
npm run build
npm run test
npm run dev:web
npm run dev:worker
npm run db:migrate
```

The worker connects to the Discord gateway, keeps the latest target presence in memory, writes interval snapshots to `presence_observations`, and updates `game_sessions` rows for active and completed sessions.

## Railway Services

- `web`: set root directory to `apps/web`
- `worker`: set root directory to `apps/worker`
- `postgres`: add a Railway PostgreSQL service and reference its `DATABASE_URL` in both app services

For the `web` service, Railway's current Next.js guide recommends `output: "standalone"` and a normal `next start`/Node start path for self-hosted deployment.
