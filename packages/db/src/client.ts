import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export type DbClient = PostgresJsDatabase<typeof schema>;

export function createDb(databaseUrl: string): DbClient {
  const client = postgres(databaseUrl, { prepare: false });
  return drizzle(client, { schema });
}
