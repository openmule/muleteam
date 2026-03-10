import { NextResponse } from "next/server";
import { getAuthenticatedEntity } from "@/lib/auth";
import { getThread, getThreadGitLog } from "@/lib/git-storage";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const entity = await getAuthenticatedEntity(request);
  if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { threadId } = await params;
  const thread = getThread(threadId);
  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

  const log = getThreadGitLog(threadId);
  return NextResponse.json({ log });
}
