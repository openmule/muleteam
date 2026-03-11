import { neon } from "@neondatabase/serverless";
import { getDatabaseUrl } from "./tenant-context";

// Cache connections by URL to avoid re-creating for the same tenant
const connectionCache = new Map<string, ReturnType<typeof neon>>();

export function db() {
  const url = getDatabaseUrl();
  let sql = connectionCache.get(url);
  if (!sql) {
    sql = neon(url);
    connectionCache.set(url, sql);
  }
  return sql;
}
