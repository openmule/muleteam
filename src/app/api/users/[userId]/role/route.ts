import { NextResponse } from "next/server";
import { getAuthenticatedEntity, requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureMigrations } from "@/lib/db-migrate";
import { withTenantFromRequest } from "@/lib/tenant-context";

const MAX_OWNERS = parseInt(process.env.MAX_OWNERS || "0", 10) || 0; // 0 = unlimited

// PATCH /api/users/[userId]/role — change a user's team role (owner only)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  return withTenantFromRequest(request, async () => {
    const entity = await getAuthenticatedEntity(request);
    if (!entity || entity.type !== "human") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ownerCheck = requireOwner(entity);
    if (ownerCheck) return ownerCheck;

    const { userId } = await params;
    const { role } = await request.json();

    if (!role || !["owner", "member"].includes(role)) {
      return NextResponse.json({ error: "Invalid role. Must be 'owner' or 'member'" }, { status: 400 });
    }

    // Cannot change your own role
    if (entity.id === userId) {
      return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
    }

    await ensureMigrations();
    const sql = await db();

    // Verify target user exists
    const target = await sql`SELECT id, team_role FROM users WHERE id = ${userId}` as { id: string; team_role: string }[];
    if (target.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // If promoting to owner, check MAX_OWNERS limit
    if (role === "owner" && MAX_OWNERS > 0) {
      const ownerCount = await sql`SELECT COUNT(*)::int as count FROM users WHERE team_role = 'owner'` as { count: number }[];
      if (ownerCount[0].count >= MAX_OWNERS) {
        return NextResponse.json({ error: `Maximum number of owners (${MAX_OWNERS}) reached` }, { status: 400 });
      }
    }

    // If demoting from owner, ensure at least one owner remains
    if (role === "member" && target[0].team_role === "owner") {
      const ownerCount = await sql`SELECT COUNT(*)::int as count FROM users WHERE team_role = 'owner'` as { count: number }[];
      if (ownerCount[0].count <= 1) {
        return NextResponse.json({ error: "Cannot demote the last owner" }, { status: 400 });
      }
    }

    await sql`UPDATE users SET team_role = ${role} WHERE id = ${userId}`;

    return NextResponse.json({ ok: true, role });
  });
}
