import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { ensureMigrations } from "@/lib/db-migrate";
import { getUser } from "@/lib/auth";
import { withTenantFromRequest } from "@/lib/tenant-context";

export async function GET(request: Request) {
  return withTenantFromRequest(request, async () => {
    try {
      const user = await getUser(request);
      if (!user) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      }

      await ensureMigrations();
      const sql = await db();
      const tokens = await sql`
        SELECT id, name, created_at, last_used_at
        FROM personal_tokens
        WHERE user_id::text = ${user.id}
        ORDER BY created_at DESC
      `;

      return NextResponse.json({ tokens });
    } catch (error) {
      console.error("GET tokens error:", error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  });
}

export async function POST(request: Request) {
  return withTenantFromRequest(request, async () => {
    try {
      const user = await getUser(request);
      if (!user) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      }

      const body = await request.json().catch(() => ({}));
      const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "default";

      const rawToken = `pt_${crypto.randomBytes(24).toString("hex")}`;
      const tokenHash = await bcrypt.hash(rawToken, 12);
      const id = Math.random().toString(36).slice(2, 14);

      await ensureMigrations();
      const sql = await db();
      await sql`
        INSERT INTO personal_tokens (id, user_id, name, token_hash)
        VALUES (${id}, ${user.id}::uuid, ${name}, ${tokenHash})
      `;

      return NextResponse.json({ id, name, token: rawToken });
    } catch (error) {
      console.error("POST tokens error:", error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  });
}

export async function DELETE(request: Request) {
  return withTenantFromRequest(request, async () => {
    try {
      const user = await getUser(request);
      if (!user) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      }

      const { searchParams } = new URL(request.url);
      const tokenId = searchParams.get("id");
      if (!tokenId) {
        return NextResponse.json({ error: "Missing token id" }, { status: 400 });
      }

      await ensureMigrations();
      const sql = await db();
      await sql`
        DELETE FROM personal_tokens
        WHERE id = ${tokenId} AND user_id::text = ${user.id}
      `;

      return NextResponse.json({ ok: true });
    } catch (error) {
      console.error("DELETE tokens error:", error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  });
}
