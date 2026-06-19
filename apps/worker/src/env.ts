import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DISCORD_BOT_TOKEN: z.string().min(1),
  DISCORD_GUILD_ID: z.string().min(1),
  DISCORD_USER_ID: z.string().min(1),
  SNAPSHOT_INTERVAL_MINUTES: z.coerce.number().int().positive().max(1440),
  TZ: z.string().min(1)
});

export type WorkerEnv = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
