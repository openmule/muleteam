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

  // Events table for the "For You" notification system
  await sql`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      thread_id TEXT NOT NULL,
      thread_title TEXT NOT NULL,
      message_id TEXT,
      actor_id TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      body TEXT,
      read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_events_user_unread ON events(user_id, read, created_at DESC)`;

  // Webhook URL column for user notification webhooks
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS webhook_url TEXT`;

  // Invites table for one-time invite links
  await sql`
    CREATE TABLE IF NOT EXISTS invites (
      token TEXT PRIMARY KEY,
      created_by TEXT NOT NULL,
      note TEXT,
      expires_at TIMESTAMPTZ NOT NULL,
      used_by TEXT,
      used_at TIMESTAMPTZ,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Team role for human users (owner vs member)
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS team_role TEXT DEFAULT 'member'`;
  // Auto-promote the first user to owner if no owner exists
  await sql`
    UPDATE users SET team_role = 'owner'
    WHERE id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)
    AND NOT EXISTS (SELECT 1 FROM users WHERE team_role = 'owner')
  `;

  // Thread pins (team-level, owner-only)
  await sql`
    CREATE TABLE IF NOT EXISTS thread_pins (
      thread_id TEXT PRIMARY KEY,
      pinned_at TIMESTAMPTZ DEFAULT NOW(),
      pinned_by TEXT NOT NULL
    )
  `;

  // Personal access tokens for human users (CLI / script access)
  await sql`
    CREATE TABLE IF NOT EXISTS personal_tokens (
      id TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT 'default',
      token_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_used_at TIMESTAMPTZ
    )
  `;
}
