import { NextResponse } from "next/server";
import { getAuthenticatedEntity } from "@/lib/auth";
import { createThread, listThreads, getAgentById, getChannel, type ThreadMeta } from "@/lib/git-storage";
import { nanoid } from "@/lib/utils";

// GET - list all threads
export async function GET(request: Request) {
  const entity = await getAuthenticatedEntity(request);
  if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const threads = listThreads();
  return NextResponse.json({ threads });
}

// POST - create a new thread
// Body: { title: string, description?: string, participantIds: string[], channel_id?: string }
export async function POST(request: Request) {
  const entity = await getAuthenticatedEntity(request);
  if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, description, participantIds, channel_id } = await request.json();
  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });

  const creatorId = entity.type === "human" ? `human:${entity.id}` : `agent:${entity.id}`;
  const participants: ThreadMeta["participants"] = [
    { id: creatorId, type: entity.type, name: entity.name }
  ];

  // If creating in a channel, auto-add all channel members
  if (channel_id) {
    const channel = getChannel(channel_id);
    if (channel) {
      for (const member of channel.members) {
        if (!participants.some(p => p.id === member.id)) {
          participants.push(member);
        }
      }
    }
  }

  // Add other participants
  for (const pid of (participantIds || [])) {
    if (participants.some(p => p.id === pid)) continue;
    if (pid.startsWith("agent:")) {
      const agentId = pid.replace("agent:", "");
      const agent = getAgentById(agentId);
      if (agent) {
        participants.push({ id: pid, type: "agent", name: agent.name });
      }
    } else {
      participants.push({ id: `human:${pid}`, type: "human", name: pid });
    }
  }

  const threadId = nanoid();
  const meta: ThreadMeta = {
    id: threadId,
    title,
    description,
    status: "open",
    participants,
    channel_id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  createThread(meta);
  return NextResponse.json({ thread: meta }, { status: 201 });
}
