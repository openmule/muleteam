import { NextResponse } from "next/server";
import { getAuthenticatedEntity } from "@/lib/auth";
import { addChannelMember, removeChannelMember, getChannel, type Participant } from "@/lib/git-storage";

// POST - add a member to channel
// Body: { id: string, type: "human"|"agent", name: string }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const entity = await getAuthenticatedEntity(request);
  if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { channelId } = await params;
  const member: Participant = await request.json();

  if (!member.id || !member.type || !member.name) {
    return NextResponse.json({ error: "id, type, and name are required" }, { status: 400 });
  }

  addChannelMember(channelId, member);
  const channel = getChannel(channelId);
  return NextResponse.json({ channel });
}

// DELETE - remove a member from channel
// Body: { memberId: string }
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const entity = await getAuthenticatedEntity(request);
  if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { channelId } = await params;
  const { memberId } = await request.json();

  if (!memberId) {
    return NextResponse.json({ error: "memberId is required" }, { status: 400 });
  }

  removeChannelMember(channelId, memberId);
  const channel = getChannel(channelId);
  return NextResponse.json({ channel });
}
