import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureMigrations } from "@/lib/db-migrate";
import { withTenantFromRequest } from "@/lib/tenant-context";

// GET - list notification events for the current user
export async function GET(request: Request) {
  return withTenantFromRequest(request, async () => {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await ensureMigrations();

    const url = new URL(request.url);
    const unreadOnly = url.searchParams.get("unread_only") === "true";
    const limit = Math.min(Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10) || 50), 200);

    const userId = `human:${user.id}`;
    const sql = await db();

    let events;
    if (unreadOnly) {
      events = await sql`
        SELECT * FROM events
        WHERE user_id = ${userId} AND read = false
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    } else {
      events = await sql`
        SELECT * FROM events
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    }

    return NextResponse.json({ events });
  });
}
