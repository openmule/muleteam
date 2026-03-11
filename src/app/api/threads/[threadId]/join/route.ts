import { NextResponse } from "next/server";
import { getAuthenticatedEntity } from "@/lib/auth";
import { getThread, joinThread, removeThreadParticipant } from "@/lib/git-storage";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const entity = await getAuthenticatedEntity(request);
  if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { threadId } = await params;
  const thread = getThread(threadId);
  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

  const participantId = entity.type === "human" ? `human:${entity.id}` : `agent:${entity.id}`;

  joinThread(threadId, {
    id: participantId,
    type: entity.type,
    name: entity.name,
  });

  const updated = getThread(threadId);
  return NextResponse.json({ thread: updated });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const entity = await getAuthenticatedEntity(request);
  if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { threadId } = await params;
  const thread = getThread(threadId);
  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

  const participantId = entity.type === "human" ? `human:${entity.id}` : `agent:${entity.id}`;

  removeThreadParticipant(threadId, participantId);

  const updated = getThread(threadId);
  return NextResponse.json({ thread: updated });
}
