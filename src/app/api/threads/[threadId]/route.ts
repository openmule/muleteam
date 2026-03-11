import { NextResponse } from "next/server";
import { getAuthenticatedEntity } from "@/lib/auth";
import { getThread, updateThread, deleteThread, isParticipant } from "@/lib/git-storage";
import { emitStatusChangeEvent } from "@/lib/events";

// GET - get single thread (open to all authenticated users)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const entity = await getAuthenticatedEntity(request);
  if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { threadId } = await params;
  const thread = getThread(threadId);
  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

  return NextResponse.json({ thread });
}

// PATCH - update thread (participants only)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const entity = await getAuthenticatedEntity(request);
  if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { threadId } = await params;

  const participantId = entity.type === "human" ? `human:${entity.id}` : `agent:${entity.id}`;
  if (!isParticipant(threadId, participantId)) {
    return NextResponse.json({ error: "You must join this thread to update it" }, { status: 403 });
  }

  const { status, description, labels } = await request.json();

  if (status && !["open", "in_progress", "done", "archived"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  // Read current thread to detect status change
  const currentThread = getThread(threadId);
  const oldStatus = currentThread?.status;

  updateThread(threadId, { status, description, labels });
  const thread = getThread(threadId);

  // Fire-and-forget: emit status change event if status actually changed
  if (status && oldStatus !== status && currentThread) {
    const actorId = participantId;
    const participantIds = currentThread.participants.map((p) => p.id);
    emitStatusChangeEvent(threadId, currentThread.title, status, actorId, entity.name, participantIds);
  }

  return NextResponse.json({ thread });
}

// DELETE - delete thread (creator or owner only)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const entity = await getAuthenticatedEntity(request);
  if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { threadId } = await params;
  const thread = getThread(threadId);
  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

  // Check permission: owner can delete any thread, members only their own
  const participantId = entity.type === "human" ? `human:${entity.id}` : `agent:${entity.id}`;
  if (entity.team_role !== "owner" && thread.created_by !== participantId) {
    return NextResponse.json({ error: "Only the thread creator or an owner can delete this thread" }, { status: 403 });
  }

  deleteThread(threadId);
  return NextResponse.json({ ok: true });
}
