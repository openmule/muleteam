import { NextResponse } from "next/server";
import { getAuthenticatedEntity, requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureMigrations } from "@/lib/db-migrate";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const entity = await getAuthenticatedEntity(request);
  if (!entity || entity.type !== "human") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await params;

  // Can only edit your own profile
  if (entity.id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const description = typeof body.description === "string" ? body.description.trim() : null;

  const sql = await db();
  await sql`UPDATE users SET description = ${description} WHERE id = ${userId}`;

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
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
  const target = await sql`SELECT id, team_role FROM users WHERE id = ${userId}` as { id: string; team_role: string }[];
  if (target.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (target[0].team_role === "owner") {
    return NextResponse.json({ error: "Cannot remove another owner" }, { status: 403 });
  }

  await sql`DELETE FROM users WHERE id = ${userId}`;

  return NextResponse.json({ ok: true });
}
