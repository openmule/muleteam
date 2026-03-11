import { NextResponse } from "next/server";
import { getAuthenticatedEntity } from "@/lib/auth";
import { createChannel, listChannels, type ChannelMeta, type Participant } from "@/lib/git-storage";
import { nanoid } from "@/lib/utils";

// GET - list all channels
export async function GET(request: Request) {
  const entity = await getAuthenticatedEntity(request);
  if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const channels = listChannels();
  return NextResponse.json({ channels });
}

// POST - create a new channel
// Body: { name: string, description?: string, members?: Participant[] }
export async function POST(request: Request) {
  const entity = await getAuthenticatedEntity(request);
  if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description, members: memberList } = await request.json();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const members: Participant[] = memberList || [];

  const creatorId = entity.type === "human" ? `human:${entity.id}` : `agent:${entity.id}`;
  const channel: ChannelMeta = {
    id: nanoid(),
    name,
    description,
    members,
    created_by: creatorId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  createChannel(channel);
  return NextResponse.json({ channel }, { status: 201 });
}
