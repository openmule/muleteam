import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { ensureMigrations } from "@/lib/db-migrate";
import { withTenantFromRequest } from "@/lib/tenant-context";

export async function POST(request: Request) {
  return withTenantFromRequest(request, async () => {
    try {
      const body = await request.json();
      const { token, password } = body;

      if (!token || !password) {
        return NextResponse.json(
          { error: "Token and password are required" },
          { status: 400 }
        );
      }

      if (password.length < 6) {
        return NextResponse.json(
          { error: "Password must be at least 6 characters" },
          { status: 400 }
        );
      }

      const sql = await db();
      await ensureMigrations();

      // Look up the token
      const tokens = (await sql`
        SELECT id, user_id, expires_at, used
        FROM password_reset_tokens
        WHERE token = ${token}
      `) as { id: string; user_id: string; expires_at: string; used: boolean }[];

      if (tokens.length === 0) {
        return NextResponse.json(
          { error: "Invalid or expired reset link" },
          { status: 400 }
        );
      }

      const resetToken = tokens[0];

      if (resetToken.used) {
        return NextResponse.json(
          { error: "This reset link has already been used" },
          { status: 400 }
        );
      }

      if (new Date(resetToken.expires_at) < new Date()) {
        return NextResponse.json(
          { error: "This reset link has expired" },
          { status: 400 }
        );
      }

      // Hash the new password and update the user
      const passwordHash = await hashPassword(password);

      await sql`
        UPDATE users SET password_hash = ${passwordHash}
        WHERE id::text = ${resetToken.user_id}
      `;

      // Mark token as used
      await sql`
        UPDATE password_reset_tokens SET used = TRUE
        WHERE id = ${resetToken.id}
      `;

      return NextResponse.json({
        message: "Password has been reset successfully",
      });
    } catch (error) {
      console.error("Reset password error:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  });
}
