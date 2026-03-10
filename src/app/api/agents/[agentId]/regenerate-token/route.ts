import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { getUser } from "@/lib/auth";
import { getAgentById } from "@/lib/git-storage";
import fs from "fs";
import path from "path";

const REPO_BASE = process.env.GIT_REPO_PATH || path.join(process.cwd(), ".data", "repo");
const AGENTS_DIR = path.join(REPO_BASE, "agents");

export async function POST(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { agentId } = await params;
  const agent = getAgentById(agentId);
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  // Generate new token
  const rawToken = `mt_${crypto.randomBytes(24).toString("hex")}`;
  const tokenHash = await bcrypt.hash(rawToken, 12);

  // Update agent record
  agent.token_hash = tokenHash;
  fs.writeFileSync(
    path.join(AGENTS_DIR, `${agentId}.json`),
    JSON.stringify(agent, null, 2)
  );

  return NextResponse.json({ token: rawToken });
}
