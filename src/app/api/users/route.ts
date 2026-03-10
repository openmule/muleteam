import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sql = db();
  const users = (await sql`SELECT id, email, name, avatar_url, created_at FROM users ORDER BY name`) as { id: string; email: string; name: string; avatar_url: string | null; created_at: string }[];

  return NextResponse.json({ users });
}
