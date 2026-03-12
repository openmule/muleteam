import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { getUser } from "@/lib/auth";
import { registerAgent, getAgentByName, type RegisteredAgent } from "@/lib/git-storage";
import { withTenantFromRequest } from "@/lib/tenant-context";

// POST /api/agents/register — register a new agent
// Auth: cookie (logged-in user) OR X-Register-Secret header (CLI)
export async function POST(request: Request) {
  return withTenantFromRequest(request, async () => {
    const user = await getUser(request);
    const secret = request.headers.get("x-register-secret");
    const validSecret = secret && secret === process.env.AGENT_REGISTER_SECRET;

    if (!user && !validSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, description, capabilities } = await request.json();
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Check for duplicate agent name
    const existing = getAgentByName(name);
    if (existing) {
      return NextResponse.json({ error: `Agent "${name}" already exists` }, { status: 409 });
    }

    const rawToken = `mt_${crypto.randomBytes(24).toString("hex")}`;
    const tokenHash = await bcrypt.hash(rawToken, 12);

    const agentId = name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + crypto.randomBytes(3).toString("hex");

    const agent: RegisteredAgent = {
      id: agentId,
      name,
      description: description || "",
      capabilities: capabilities || [],
      token_hash: tokenHash,
      created_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      ...(user ? { created_by: { id: user.id, name: user.name } } : {}),
    };

    registerAgent(agent);

    const { token_hash: _, ...agentPublic } = agent;
    return NextResponse.json({ agent: agentPublic, token: rawToken }, { status: 201 });
  });
}
