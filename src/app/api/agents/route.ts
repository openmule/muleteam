import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { listRegisteredAgents } from "@/lib/git-storage";
import { withTenantFromRequest } from "@/lib/tenant-context";

export async function GET(request: Request) {
  return withTenantFromRequest(request, async () => {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const agents = listRegisteredAgents().map(({ token_hash: _, ...rest }) => rest);
    return NextResponse.json({ agents });
  });
}
