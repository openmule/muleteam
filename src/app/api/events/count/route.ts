import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureMigrations } from "@/lib/db-migrate";

// GET - count unread events for the current user
export async function GET(request: Request) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureMigrations();

  const userId = `human:${user.id}`;
  const sql = db();

  const result = (await sql`
    SELECT COUNT(*)::int AS unread FROM events
    WHERE user_id = ${userId} AND read = false
  `) as { unread: number }[];

  return NextResponse.json({ unread: result[0]?.unread ?? 0 });
}
