import { db } from "./db";

let _migrated = false;
let _migrationPromise: Promise<void> | null = null;

/**
 * Run idempotent schema migrations. Safe to call multiple times —
 * only the first invocation per process actually runs SQL.
 * Concurrent callers await the same promise.
 */
export async function ensureMigrations(): Promise<void> {
  if (_migrated) return;
  if (_migrationPromise) return _migrationPromise;

  _migrationPromise = runMigrations();
  try {
    await _migrationPromise;
    _migrated = true;
  } catch (err) {
    // Allow retry on next call if migration failed
    _migrationPromise = null;
    throw err;
  }
}

async function runMigrations(): Promise<void> {
  const sql = db();

  // Each statement is idempotent (IF NOT EXISTS) — safe to re-run.
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS description TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by JSONB`;
}
