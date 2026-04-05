import { NextResponse } from "next/server";
import { withTenantFromRequest } from "@/lib/tenant-context";
import { cookieOptions } from "@/lib/cookie";

export async function POST(request: Request) {
  return withTenantFromRequest(request, async () => {
    const response = NextResponse.json({ ok: true });
    response.cookies.set("token", "", {
      ...cookieOptions,
      maxAge: 0,
    });
    return response;
  });
}
