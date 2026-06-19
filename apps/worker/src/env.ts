import dotenv from "dotenv";
import { z, type ZodFormattedError } from "zod";

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

export type WorkerEnvLoadResult =
  | {
      ok: true;
      env: WorkerEnv;
    }
  | {
      ok: false;
      error: ZodFormattedError<WorkerEnv>;
      missingKeys: string[];
    };

export function loadEnv(source: NodeJS.ProcessEnv = process.env): WorkerEnvLoadResult {
  const parsed = envSchema.safeParse(source);

  if (parsed.success) {
    return {
      ok: true,
      env: parsed.data
    };
  }

  const missingKeys = Object.entries(parsed.error.flatten().fieldErrors)
    .filter(([, errors]) => (errors ?? []).length > 0)
    .map(([key]) => key);

  return {
    ok: false,
    error: parsed.error.format(),
    missingKeys
  };
}
