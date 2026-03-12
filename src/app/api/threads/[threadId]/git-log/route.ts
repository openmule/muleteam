import { NextResponse } from "next/server";
import { getAuthenticatedEntity } from "@/lib/auth";
import { getThread, getThreadGitLog } from "@/lib/git-storage";
import { withTenantFromRequest } from "@/lib/tenant-context";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  return withTenantFromRequest(request, async () => {
    const entity = await getAuthenticatedEntity(request);
    if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { threadId } = await params;
    const thread = getThread(threadId);
    if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

    const url = new URL(request.url);
    const limit = Math.min(Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10) || 20), 500);
    const log = getThreadGitLog(threadId, limit);
    return NextResponse.json({ log });
  });
}
