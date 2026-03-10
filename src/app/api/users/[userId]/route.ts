import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await params;

  // Cannot delete yourself
  if (user.id === userId) {
    return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
  }

  const sql = db();
  // Check user exists first
  const existing = await sql`SELECT id FROM users WHERE id = ${userId}`;
  if ((existing as unknown[]).length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  await sql`DELETE FROM users WHERE id = ${userId}`;

  return NextResponse.json({ ok: true });
}
