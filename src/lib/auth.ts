import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

interface UserPayload {
  id: string;
  email: string;
  name: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: UserPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: "7d" });
}

export function verifyToken(token: string): UserPayload | null {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as UserPayload;
  } catch {
    return null;
  }
}

export async function getUser(
  request: Request
): Promise<UserPayload | null> {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  const match = cookieHeader.match(/(?:^|;\s*)token=([^;]*)/);
  if (!match) return null;

  const token = match[1];
  return verifyToken(token);
}

// Unified auth: returns user payload OR agent info from Bearer token
export type AuthResult = {
  type: "human";
  id: string;
  name: string;
  email: string;
  team_role: "owner" | "member";
} | {
  type: "agent";
  id: string;
  name: string;
  team_role: "member"; // agents are always members
}

export async function getAuthenticatedEntity(
  request: Request
): Promise<AuthResult | null> {
  // Try cookie auth first (human user)
  const user = await getUser(request);
  if (user) {
    const teamRole = await getTeamRole(user.id);
    return { type: "human", id: user.id, name: user.name, email: user.email, team_role: teamRole };
  }

  // Try Bearer token (agent or human PAT)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const rawToken = authHeader.slice(7);

    // Check human PAT first (pt_ prefix)
    if (rawToken.startsWith("pt_")) {
      const humanFromPat = await getHumanFromPAT(rawToken);
      if (humanFromPat) {
        const teamRole = await getTeamRole(humanFromPat.id);
        return { type: "human", id: humanFromPat.id, name: humanFromPat.name, email: humanFromPat.email, team_role: teamRole };
      }
    }

    // Lazy import to avoid circular deps
    const { getAgentFromBearer } = await import("./agent-auth");
    const agent = await getAgentFromBearer(request);
    if (agent) {
      return { type: "agent", id: agent.id, name: agent.name, team_role: "member" };
    }
  }

  return null;
}

async function getTeamRole(userId: string): Promise<"owner" | "member"> {
  try {
    const sql = (await import("./db")).db();
    const rows = await sql`SELECT team_role FROM users WHERE id = ${userId}` as { team_role: string | null }[];
    if (rows.length > 0 && rows[0].team_role === "owner") return "owner";
  } catch {
    // Default to member on error
  }
  return "member";
}

/** Check if the authenticated entity is an owner. Returns 403 response if not. */
export function requireOwner(entity: AuthResult): Response | null {
  if (entity.team_role !== "owner") {
    return Response.json({ error: "Owner access required" }, { status: 403 });
  }
  return null;
}

async function getHumanFromPAT(rawToken: string): Promise<{ id: string; name: string; email: string } | null> {
  try {
    const sql = (await import("./db")).db();
    const rows = await sql`
      SELECT pt.id AS token_id, pt.token_hash, u.id, u.name, u.email
      FROM personal_tokens pt
      JOIN users u ON u.id = pt.user_id
    ` as { token_id: string; token_hash: string; id: string; name: string; email: string }[];

    for (const row of rows) {
      const match = await bcrypt.compare(rawToken, row.token_hash);
      if (match) {
        // Fire-and-forget: update last_used_at
        sql`UPDATE personal_tokens SET last_used_at = NOW() WHERE id = ${row.token_id}`.catch(() => {});
        return { id: row.id, name: row.name, email: row.email };
      }
    }
  } catch (err) {
    console.error("PAT auth error:", err);
  }
  return null;
}
