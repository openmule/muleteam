import { NextResponse } from "next/server";
import { withTenantFromRequest } from "@/lib/tenant-context";

export async function POST(request: Request) {
  return withTenantFromRequest(request, async () => {
    const response = NextResponse.json({ ok: true });
    response.cookies.set("token", "", {
      httpOnly: true,
      path: "/",
      maxAge: 0,
      sameSite: "lax",
    });
    return response;
  });
}
