import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { getAgentById, deleteAgent } from "@/lib/git-storage";
import { withTenantFromRequest } from "@/lib/tenant-context";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  return withTenantFromRequest(request, async () => {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { agentId } = await params;
    const agent = getAgentById(agentId);
    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

    const { token_hash: _, ...agentPublic } = agent;
    return NextResponse.json({ agent: agentPublic });
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  return withTenantFromRequest(request, async () => {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { agentId } = await params;
    const deleted = deleteAgent(agentId);
    if (!deleted) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

    return NextResponse.json({ ok: true });
  });
}
