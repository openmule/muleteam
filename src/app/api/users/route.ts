import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureMigrations } from "@/lib/db-migrate";

export async function GET(request: Request) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureMigrations();
  const sql = db();
  const rows = (await sql`SELECT id, email, name, description, avatar_url, created_at, invited_by, team_role FROM users ORDER BY name`) as { id: string; email: string; name: string; description: string | null; avatar_url: string | null; created_at: string; invited_by: { id: string; name: string } | null; team_role: string | null }[];

  // Only include email for the requesting user's own record
  const users = rows.map(({ email, ...rest }) =>
    rest.id === user.id ? { ...rest, email } : rest
  );

  return NextResponse.json({ users });
}
