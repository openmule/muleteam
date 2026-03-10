import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureMigrations } from "@/lib/db-migrate";

// POST - mark all events as read for the current user
export async function POST(request: Request) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureMigrations();

  const userId = `human:${user.id}`;
  const sql = db();

  await sql`
    UPDATE events SET read = true
    WHERE user_id = ${userId} AND read = false
  `;

  return NextResponse.json({ ok: true });
}
