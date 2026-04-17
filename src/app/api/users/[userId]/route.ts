import { NextResponse } from "next/server";
import { getAuthenticatedEntity, requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureMigrations } from "@/lib/db-migrate";
import { withTenantFromRequest } from "@/lib/tenant-context";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  return withTenantFromRequest(request, async () => {
    const entity = await getAuthenticatedEntity(request);
    if (!entity || entity.type !== "human") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { userId } = await params;

    // Can only edit your own profile
    if (entity.id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    await ensureMigrations();
    const sql = await db();

    // Build dynamic update
    if (typeof body.name === "string" && body.name.trim()) {
      const name = body.name.trim();
      await sql`UPDATE users SET name = ${name} WHERE id::text = ${userId}`;
    }
    if (typeof body.description === "string") {
      const description = body.description.trim() || null;
      await sql`UPDATE users SET description = ${description} WHERE id::text = ${userId}`;
    }

    // Fetch updated user to return
    const result = (await sql`
      SELECT id, email, name, description, avatar_url, team_role FROM users WHERE id::text = ${userId}
    `) as { id: string; email: string; name: string; description: string | null; avatar_url: string | null; team_role: string | null }[];

    return NextResponse.json({ ok: true, user: result[0] ?? null });
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  return withTenantFromRequest(request, async () => {
    const entity = await getAuthenticatedEntity(request);
    if (!entity || entity.type !== "human") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Only owners can remove members
    const ownerCheck = requireOwner(entity);
    if (ownerCheck) return ownerCheck;

    const { userId } = await params;

    // Cannot delete yourself
    if (entity.id === userId) {
      return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
    }

    await ensureMigrations();
    const sql = await db();

    // Cannot delete another owner
    const target = await sql`SELECT id, team_role FROM users WHERE id::text = ${userId}` as { id: string; team_role: string }[];
    if (target.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (target[0].team_role === "owner") {
      return NextResponse.json({ error: "Cannot remove another owner" }, { status: 403 });
    }

    await sql`DELETE FROM users WHERE id::text = ${userId}`;

    return NextResponse.json({ ok: true });
  });
}
