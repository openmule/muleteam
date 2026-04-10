import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { ensureMigrations } from "@/lib/db-migrate";
import { withTenantFromRequest } from "@/lib/tenant-context";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  return withTenantFromRequest(request, async () => {
    try {
      const { token } = await params;
      await ensureMigrations();
      const sql = await db();

      // Validate the invite token
      const invites = (await sql`
        SELECT token, created_by, status, expires_at
        FROM invites
        WHERE token = ${token}
      `) as { token: string; created_by: string; status: string; expires_at: string }[];

      if (invites.length === 0) {
        return NextResponse.json({ error: "Invalid invite link" }, { status: 400 });
      }

      const invite = invites[0];
      if (invite.status !== "pending") {
        return NextResponse.json({ error: "This invite link has already been used or revoked" }, { status: 400 });
      }
      if (new Date(invite.expires_at) < new Date()) {
        return NextResponse.json({ error: "This invite link has expired" }, { status: 400 });
      }

      // Parse and validate body
      const body = await request.json();
      const { name, email, password, description } = body;

      if (!name || !email || !password) {
        return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
      }

      if (password.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
      }

      // Check if email already exists
      const existing = (await sql`SELECT id FROM users WHERE email = ${email}`) as { id: string }[];
      if (existing.length > 0) {
        return NextResponse.json({ error: "Email already registered" }, { status: 409 });
      }

      // Look up the creator's name for invited_by
      const creators = (await sql`SELECT name FROM users WHERE id::text = ${invite.created_by}`) as { name: string }[];
      const creatorName = creators.length > 0 ? creators[0].name : "Unknown";

      // Create the user
      const passwordHash = await hashPassword(password);
      const invitedBy = JSON.stringify({ id: invite.created_by, name: creatorName });
      const result = (await sql`
        INSERT INTO users (email, password_hash, name, description, invited_by)
        VALUES (${email}, ${passwordHash}, ${name.trim()}, ${description?.trim() || null}, ${invitedBy}::jsonb)
        RETURNING id, email, name
      `) as { id: string; email: string; name: string }[];

      const user = result[0];

      // Mark invite as used
      await sql`
        UPDATE invites
        SET status = 'used', used_by = ${user.id}, used_at = NOW()
        WHERE token = ${token}
      `;

      return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } });
    } catch (error) {
      console.error("Invite registration error:", error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  });
}
