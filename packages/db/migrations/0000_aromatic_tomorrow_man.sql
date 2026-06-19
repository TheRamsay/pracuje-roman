CREATE EXTENSION IF NOT EXISTS "pgcrypto";
--> statement-breakpoint
CREATE TABLE "game_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discord_user_id" text NOT NULL,
	"game_name" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_observed_at" timestamp with time zone NOT NULL,
	"duration_seconds" integer
);
--> statement-breakpoint
CREATE TABLE "presence_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discord_user_id" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"activity_name" text,
	"activity_type" text,
	"is_wow" boolean DEFAULT false NOT NULL,
	"activity_started_at" timestamp with time zone,
	"raw_json" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "game_sessions_active_idx" ON "game_sessions" USING btree ("discord_user_id","is_active");--> statement-breakpoint
CREATE INDEX "game_sessions_started_at_idx" ON "game_sessions" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "presence_observations_observed_at_idx" ON "presence_observations" USING btree ("observed_at");--> statement-breakpoint
CREATE INDEX "presence_observations_user_observed_at_idx" ON "presence_observations" USING btree ("discord_user_id","observed_at");
