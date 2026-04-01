import { NextResponse } from "next/server";
import { getAuthenticatedEntity } from "@/lib/auth";
import { getThread, getFileAtCommit } from "@/lib/git-storage";
import { withTenantFromRequest } from "@/lib/tenant-context";

// GET - retrieve a workspace file at a specific git commit
// ?commit=abc123&file=design.html
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
    const commit = url.searchParams.get("commit");
    const file = url.searchParams.get("file");

    if (!commit || !file) {
      return NextResponse.json({ error: "commit and file params required" }, { status: 400 });
    }

    // Sanitize: only allow safe commit hash chars
    if (!/^[a-f0-9]{7,40}$/.test(commit)) {
      return NextResponse.json({ error: "Invalid commit hash" }, { status: 400 });
    }

    const filePath = `threads/${threadId}/workspace/${file}`;
    const content = getFileAtCommit(commit, filePath);

    if (content === null) {
      return NextResponse.json({ error: "File not found at this commit" }, { status: 404 });
    }

    const ext = file.split(".").pop()?.toLowerCase();
    if (ext === "html" || ext === "htm") {
      return new NextResponse(content, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return NextResponse.json({ content });
  });
}
