import { NextResponse } from "next/server";
import { getAuthenticatedEntity } from "@/lib/auth";
import { getThread, updateThread, deleteThread, isParticipant } from "@/lib/git-storage";

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

  updateThread(threadId, { status, description, labels });
  const thread = getThread(threadId);
  return NextResponse.json({ thread });
}

// DELETE - delete thread
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const entity = await getAuthenticatedEntity(request);
  if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { threadId } = await params;
  const deleted = deleteThread(threadId);
  if (!deleted) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
