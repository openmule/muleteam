import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, getUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const inviter = await getUser(request);
    const body = await request.json();
    const { email, password, name } = body;

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Email, password, and name are required" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const sql = db();

    const existing = (await sql`SELECT id FROM users WHERE email = ${email}`) as { id: string }[];
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const invitedBy = inviter ? JSON.stringify({ id: inviter.id, name: inviter.name }) : null;
    const result = (await sql`
      INSERT INTO users (email, password_hash, name, invited_by)
      VALUES (${email}, ${passwordHash}, ${name}, ${invitedBy}::jsonb)
      RETURNING id, email, name
    `) as { id: string; email: string; name: string }[];

    const user = result[0];

    return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
