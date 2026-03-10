import bcrypt from "bcryptjs";
import { listRegisteredAgents, updateAgentLastSeen, type RegisteredAgent } from "./git-storage";

export function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

export async function getAgentFromBearer(request: Request): Promise<RegisteredAgent | null> {
  const token = extractBearerToken(request);
  if (!token) return null;

  const agents = listRegisteredAgents();
  for (const agent of agents) {
    const match = await bcrypt.compare(token, agent.token_hash);
    if (match) {
      // Update last_seen
      updateAgentLastSeen(agent.id);
      return agent;
    }
  }
  return null;
}
