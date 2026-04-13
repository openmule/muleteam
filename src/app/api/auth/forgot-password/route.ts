import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureMigrations } from "@/lib/db-migrate";
import { withTenantFromRequest } from "@/lib/tenant-context";
import { nanoid } from "@/lib/utils";
import { headers } from "next/headers";

export async function POST(request: Request) {
  return withTenantFromRequest(request, async () => {
    try {
      const body = await request.json();
      const { email } = body;

      if (!email) {
        return NextResponse.json(
          { error: "Email is required" },
          { status: 400 }
        );
      }

      const sql = await db();
      await ensureMigrations();

      // Look up user by email
      const users = (await sql`
        SELECT id, email FROM users WHERE email = ${email}
      `) as { id: string; email: string }[];

      // Always return success to avoid leaking whether an email exists
      if (users.length === 0) {
        return NextResponse.json({
          message: "If an account exists with that email, a reset link has been sent.",
        });
      }

      const user = users[0];

      // Invalidate any existing unused tokens for this user
      await sql`
        UPDATE password_reset_tokens
        SET used = TRUE
        WHERE user_id = ${user.id} AND used = FALSE
      `;

      // Generate reset token and store it (1 hour expiry)
      const token = nanoid(32);
      const tokenId = nanoid(12);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await sql`
        INSERT INTO password_reset_tokens (id, user_id, token, expires_at)
        VALUES (${tokenId}, ${user.id}, ${token}, ${expiresAt.toISOString()})
      `;

      // Build the reset URL from the request origin
      const headerStore = await headers();
      const host = headerStore.get("host") || "localhost:3000";
      const proto = headerStore.get("x-forwarded-proto") || "http";
      const resetUrl = `${proto}://${host}/reset-password?token=${token}`;

      // TODO: Send email via Resend once the `resend` package is installed and RESEND_API_KEY is configured.
      // For now, log the reset link to the console as a fallback.
      console.log(`[Forgot Password] Reset link for ${email}: ${resetUrl}`);

      return NextResponse.json({
        message: "If an account exists with that email, a reset link has been sent.",
      });
    } catch (error) {
      console.error("Forgot password error:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  });
}
