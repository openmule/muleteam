import { neon } from "@neondatabase/serverless";
import { getDatabaseUrl } from "./tenant-context";
import pg from "pg";

// Cache connections by URL to avoid re-creating for the same tenant
const connectionCache = new Map<string, ReturnType<typeof neon>>();
const pgPoolCache = new Map<string, pg.Pool>();

function isLocalUrl(url: string) {
  return url.includes("localhost") || url.includes("127.0.0.1");
}

// Create a neon-compatible tagged template function using pg.Pool
function createLocalSql(pool: pg.Pool) {
  return async function sql(strings: TemplateStringsArray, ...values: unknown[]) {
    const text = strings.reduce((prev, curr, i) => prev + "$" + i + curr);
    const result = await pool.query(text, values);
    return result.rows;
  } as ReturnType<typeof neon>;
}

export async function db() {
  const url = await getDatabaseUrl();

  if (isLocalUrl(url)) {
    let pool = pgPoolCache.get(url);
    if (!pool) {
      pool = new pg.Pool({ connectionString: url });
      pgPoolCache.set(url, pool);
    }
    return createLocalSql(pool);
  }

  let sql = connectionCache.get(url);
  if (!sql) {
    sql = neon(url);
    connectionCache.set(url, sql);
  }
  return sql;
}
