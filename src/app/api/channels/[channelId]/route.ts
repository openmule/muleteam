import { NextResponse } from "next/server";
import { getAuthenticatedEntity } from "@/lib/auth";
import { getChannel, updateChannel, deleteChannel } from "@/lib/git-storage";

// GET - get a single channel
export async function GET(
  request: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const entity = await getAuthenticatedEntity(request);
  if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { channelId } = await params;
  const channel = getChannel(channelId);
  if (!channel) return NextResponse.json({ error: "Channel not found" }, { status: 404 });

  return NextResponse.json({ channel });
}

// PATCH - update channel name/description
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const entity = await getAuthenticatedEntity(request);
  if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { channelId } = await params;
  const { name, description } = await request.json();

  updateChannel(channelId, { name, description });
  const channel = getChannel(channelId);
  return NextResponse.json({ channel });
}

// DELETE - delete a channel
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const entity = await getAuthenticatedEntity(request);
  if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { channelId } = await params;
  const deleted = deleteChannel(channelId);
  if (!deleted) return NextResponse.json({ error: "Channel not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
