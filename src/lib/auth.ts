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
} | {
  type: "agent";
  id: string;
  name: string;
}

export async function getAuthenticatedEntity(
  request: Request
): Promise<AuthResult | null> {
  // Try cookie auth first (human user)
  const user = await getUser(request);
  if (user) {
    return { type: "human", id: user.id, name: user.name, email: user.email };
  }

  // Try Bearer token (agent)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    // Lazy import to avoid circular deps
    const { getAgentFromBearer } = await import("./agent-auth");
    const agent = await getAgentFromBearer(request);
    if (agent) {
      return { type: "agent", id: agent.id, name: agent.name };
    }
  }

  return null;
}
