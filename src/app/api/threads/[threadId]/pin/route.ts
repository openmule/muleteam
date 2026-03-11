import { NextResponse } from "next/server";
import { getAuthenticatedEntity, requireOwner } from "@/lib/auth";
import { getThread } from "@/lib/git-storage";
import { db } from "@/lib/db";
import { ensureMigrations } from "@/lib/db-migrate";

// POST - pin a thread (owner only)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const entity = await getAuthenticatedEntity(request);
  if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerCheck = requireOwner(entity);
  if (ownerCheck) return ownerCheck;

  const { threadId } = await params;
  const thread = getThread(threadId);
  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

  await ensureMigrations();
  const sql = db();
  const pinnedBy = entity.type === "human" ? `human:${entity.id}` : `agent:${entity.id}`;

  await sql`
    INSERT INTO thread_pins (thread_id, pinned_by, pinned_at)
    VALUES (${threadId}, ${pinnedBy}, NOW())
    ON CONFLICT (thread_id) DO NOTHING
  `;

  return NextResponse.json({ ok: true });
}

// DELETE - unpin a thread (owner only)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const entity = await getAuthenticatedEntity(request);
  if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerCheck = requireOwner(entity);
  if (ownerCheck) return ownerCheck;

  const { threadId } = await params;

  await ensureMigrations();
  const sql = db();
  await sql`DELETE FROM thread_pins WHERE thread_id = ${threadId}`;

  return NextResponse.json({ ok: true });
}
