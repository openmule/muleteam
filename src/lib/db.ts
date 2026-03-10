import { neon } from "@neondatabase/serverless";

let _sql: ReturnType<typeof neon> | null = null;

export function db() {
  if (!_sql) {
    _sql = neon(process.env.DATABASE_URL!);
  }
  return _sql;
}
