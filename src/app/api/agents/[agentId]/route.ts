import { NextResponse } from "next/server";
import { getAuthenticatedEntity } from "@/lib/auth";
import { getAgentById, deleteAgent, updateAgent } from "@/lib/git-storage";
import { withTenantFromRequest } from "@/lib/tenant-context";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  return withTenantFromRequest(request, async () => {
    const entity = await getAuthenticatedEntity(request);
    if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { agentId } = await params;
    const agent = getAgentById(agentId);
    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

    const { token_hash: _, ...agentPublic } = agent;
    return NextResponse.json({ agent: agentPublic });
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  return withTenantFromRequest(request, async () => {
    const entity = await getAuthenticatedEntity(request);
    if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { agentId } = await params;
    const body = await request.json();
    const updates: { name?: string; description?: string; capabilities?: string[] } = {};

    if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
    if (typeof body.description === "string") updates.description = body.description;
    if (Array.isArray(body.capabilities)) {
      updates.capabilities = body.capabilities
        .filter((t: unknown) => typeof t === "string" && t.trim())
        .map((t: string) => t.trim())
        .slice(0, 20);
    }

    const agent = updateAgent(agentId, updates);
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
    const entity = await getAuthenticatedEntity(request);
    if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { agentId } = await params;
    const deleted = deleteAgent(agentId);
    if (!deleted) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

    return NextResponse.json({ ok: true });
  });
}
