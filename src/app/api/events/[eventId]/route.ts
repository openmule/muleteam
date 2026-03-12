import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureMigrations } from "@/lib/db-migrate";
import { withTenantFromRequest } from "@/lib/tenant-context";

// PATCH - mark a single event as read
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  return withTenantFromRequest(request, async () => {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await ensureMigrations();

    const { eventId } = await params;
    const userId = `human:${user.id}`;
    const sql = await db();

    await sql`
      UPDATE events SET read = true
      WHERE id = ${eventId} AND user_id = ${userId}
    `;

    return NextResponse.json({ ok: true });
  });
}
