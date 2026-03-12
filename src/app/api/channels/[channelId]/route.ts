import { NextResponse } from "next/server";
import { getAuthenticatedEntity } from "@/lib/auth";
import { getChannel, updateChannel, deleteChannel } from "@/lib/git-storage";
import { withTenantFromRequest } from "@/lib/tenant-context";

// GET - get a single channel
export async function GET(
  request: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  return withTenantFromRequest(request, async () => {
    const entity = await getAuthenticatedEntity(request);
    if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { channelId } = await params;
    const channel = getChannel(channelId);
    if (!channel) return NextResponse.json({ error: "Channel not found" }, { status: 404 });

    return NextResponse.json({ channel });
  });
}

// PATCH - update channel name/description
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  return withTenantFromRequest(request, async () => {
    const entity = await getAuthenticatedEntity(request);
    if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { channelId } = await params;
    const { name, description } = await request.json();

    updateChannel(channelId, { name, description });
    const channel = getChannel(channelId);
    return NextResponse.json({ channel });
  });
}

// DELETE - delete a channel (creator or owner only)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  return withTenantFromRequest(request, async () => {
    const entity = await getAuthenticatedEntity(request);
    if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { channelId } = await params;
    const channel = getChannel(channelId);
    if (!channel) return NextResponse.json({ error: "Channel not found" }, { status: 404 });

    // Check permission: owner can delete any channel, members only their own
    const participantId = entity.type === "human" ? `human:${entity.id}` : `agent:${entity.id}`;
    if (entity.team_role !== "owner" && channel.created_by !== participantId) {
      return NextResponse.json({ error: "Only the channel creator or an owner can delete this channel" }, { status: 403 });
    }

    deleteChannel(channelId);
    return NextResponse.json({ ok: true });
  });
}
