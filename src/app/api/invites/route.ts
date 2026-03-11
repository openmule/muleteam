import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureMigrations } from "@/lib/db-migrate";

export async function POST(request: Request) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureMigrations();
  const sql = db();

  const body = await request.json().catch(() => ({}));
  const note = body.note || null;

  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await sql`
    INSERT INTO invites (token, created_by, note, expires_at)
    VALUES (${token}, ${user.id}, ${note}, ${expiresAt})
  `;

  return NextResponse.json({ token, expires_at: expiresAt });
}

export async function GET(request: Request) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureMigrations();
  const sql = db();

  const rows = (await sql`
    SELECT i.token, i.created_by, i.note, i.expires_at, i.used_by, i.used_at, i.status, i.created_at,
           u.name as creator_name
    FROM invites i
    LEFT JOIN users u ON i.created_by = u.id
    ORDER BY i.created_at DESC
  `) as {
    token: string;
    created_by: string;
    note: string | null;
    expires_at: string;
    used_by: string | null;
    used_at: string | null;
    status: string;
    created_at: string;
    creator_name: string | null;
  }[];

  // Compute effective status (check expiry for pending invites)
  const invites = rows.map((row) => ({
    ...row,
    status:
      row.status === "pending" && new Date(row.expires_at) < new Date()
        ? "expired"
        : row.status,
  }));

  return NextResponse.json({ invites });
}
