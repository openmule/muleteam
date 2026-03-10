import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const sql = db();

    const result = (await sql`
      SELECT id, email, name, avatar_url FROM users WHERE id = ${user.id}
    `) as { id: string; email: string; name: string; avatar_url: string | null }[];

    if (result.length === 0) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 401 }
      );
    }

    const fullUser = result[0];

    return NextResponse.json({
      user: {
        id: fullUser.id,
        email: fullUser.email,
        name: fullUser.name,
        avatar_url: fullUser.avatar_url,
      },
    });
  } catch (error) {
    console.error("Me error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
