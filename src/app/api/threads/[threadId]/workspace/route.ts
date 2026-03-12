import { NextResponse } from "next/server";
import { getAuthenticatedEntity } from "@/lib/auth";
import { listWorkspaceFiles } from "@/lib/git-storage";
import { withTenantFromRequest } from "@/lib/tenant-context";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  return withTenantFromRequest(request, async () => {
    const entity = await getAuthenticatedEntity(request);
    if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { threadId } = await params;
    const files = listWorkspaceFiles(threadId);
    return NextResponse.json({ files });
  });
}
