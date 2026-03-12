import { NextResponse } from "next/server";
import { getAuthenticatedEntity } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureMigrations } from "@/lib/db-migrate";
import { withTenantFromRequest } from "@/lib/tenant-context";

// GET - list all pinned thread IDs (sorted by pin time)
export async function GET(request: Request) {
  return withTenantFromRequest(request, async () => {
    const entity = await getAuthenticatedEntity(request);
    if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await ensureMigrations();
    const sql = await db();
    const rows = await sql`
      SELECT thread_id, pinned_at, pinned_by
      FROM thread_pins
      ORDER BY pinned_at ASC
    ` as { thread_id: string; pinned_at: string; pinned_by: string }[];

    return NextResponse.json({ pins: rows });
  });
}
