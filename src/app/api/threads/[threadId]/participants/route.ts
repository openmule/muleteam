import { NextResponse } from "next/server";
import { getAuthenticatedEntity } from "@/lib/auth";
import { getThread, joinThread, getAgentById } from "@/lib/git-storage";
import { db } from "@/lib/db";
import { emitJoinEvent } from "@/lib/events";

// POST - add a participant to thread
// Body: { participantId: string } — e.g. "agent:abc123" or "human:uuid"
export async function POST(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const entity = await getAuthenticatedEntity(request);
  if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { threadId } = await params;
  const thread = getThread(threadId);
  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

  const { participantId } = await request.json();
  if (!participantId) {
    return NextResponse.json({ error: "participantId is required" }, { status: 400 });
  }

  // Already a participant
  if (thread.participants.some(p => p.id === participantId)) {
    return NextResponse.json({ thread });
  }

  // Resolve participant info
  if (participantId.startsWith("agent:")) {
    const agentId = participantId.replace("agent:", "");
    const agent = getAgentById(agentId);
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
    joinThread(threadId, { id: participantId, type: "agent", name: agent.name });
  } else if (participantId.startsWith("human:")) {
    const userId = participantId.replace("human:", "");
    const sql = await db();
    const users = (await sql`SELECT id, name FROM users WHERE id = ${userId}`) as { id: string; name: string }[];
    if (users.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    joinThread(threadId, { id: participantId, type: "human", name: users[0].name });
  } else {
    return NextResponse.json({ error: "participantId must start with 'agent:' or 'human:'" }, { status: 400 });
  }

  // Fire-and-forget: emit join event if someone else added this participant
  const actorId = entity.type === "human" ? `human:${entity.id}` : `agent:${entity.id}`;
  if (actorId !== participantId) {
    emitJoinEvent(threadId, thread.title, participantId, actorId, entity.name);
  }

  const updated = getThread(threadId);
  return NextResponse.json({ thread: updated });
}
