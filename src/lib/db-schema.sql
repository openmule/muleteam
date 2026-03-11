CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'human' CHECK (role IN ('human', 'agent')),
  team_role TEXT DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration: add description column if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS description TEXT;

-- Migration: add invited_by column (JSON: {id, name} of inviter)
ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by JSONB;

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Events table for "For You" notification system
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
);
CREATE INDEX IF NOT EXISTS idx_events_user_unread ON events(user_id, read, created_at DESC);
