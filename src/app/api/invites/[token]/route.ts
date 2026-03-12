import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureMigrations } from "@/lib/db-migrate";

// GET /api/invites/[token] — validate an invite token (public, no auth)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  await ensureMigrations();
  const sql = await db();

  const rows = (await sql`
    SELECT token, note, expires_at, status, created_at
    FROM invites
    WHERE token = ${token}
  `) as { token: string; note: string | null; expires_at: string; status: string; created_at: string }[];

  if (rows.length === 0) {
    return NextResponse.json({ valid: false, reason: "not_found" });
  }

  const invite = rows[0];
  if (invite.status !== "pending") {
    return NextResponse.json({ valid: false, reason: invite.status });
  }
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ valid: false, reason: "expired" });
  }

  return NextResponse.json({ valid: true, note: invite.note, expires_at: invite.expires_at });
}

// DELETE /api/invites/[token] — revoke an invite (auth required)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { token } = await params;
  await ensureMigrations();
  const sql = await db();

  await sql`UPDATE invites SET status = 'revoked' WHERE token = ${token} AND status = 'pending'`;

  return NextResponse.json({ ok: true });
}
