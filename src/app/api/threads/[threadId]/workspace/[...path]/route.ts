import { NextResponse } from "next/server";
import { getAuthenticatedEntity } from "@/lib/auth";
import { readWorkspaceFile, readWorkspaceBinary, writeWorkspaceFile, deleteWorkspaceFile, isParticipant } from "@/lib/git-storage";
import { withTenantFromRequest } from "@/lib/tenant-context";

const BINARY_EXTENSIONS: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

function isBinaryFile(filePath: string): boolean {
  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  return ext in BINARY_EXTENSIONS;
}

function getMimeType(filePath: string): string {
  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  return BINARY_EXTENSIONS[ext] || "application/octet-stream";
}

// GET — read a workspace file (open to all authenticated users)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ threadId: string; path: string[] }> }
) {
  return withTenantFromRequest(request, async () => {
    const entity = await getAuthenticatedEntity(request);
    if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { threadId, path: pathSegments } = await params;
    const filePath = pathSegments.join("/");

    try {
      if (isBinaryFile(filePath)) {
        const data = readWorkspaceBinary(threadId, filePath);
        if (data === null) return NextResponse.json({ error: "File not found" }, { status: 404 });
        return new NextResponse(new Uint8Array(data), {
          headers: {
            "Content-Type": getMimeType(filePath),
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }

      const content = readWorkspaceFile(threadId, filePath);
      if (content === null) return NextResponse.json({ error: "File not found" }, { status: 404 });
      return NextResponse.json({ content, path: filePath });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 400 });
    }
  });
}

// PUT — write a workspace file (participants only)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ threadId: string; path: string[] }> }
) {
  return withTenantFromRequest(request, async () => {
    const entity = await getAuthenticatedEntity(request);
    if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { threadId, path: pathSegments } = await params;

    const participantId = entity.type === "human" ? `human:${entity.id}` : `agent:${entity.id}`;
    if (!isParticipant(threadId, participantId)) {
      return NextResponse.json({ error: "You must join this thread to write files" }, { status: 403 });
    }

    const filePath = pathSegments.join("/");
    const { content } = await request.json();

    if (content === undefined) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    try {
      await writeWorkspaceFile(threadId, filePath, content, entity.name);
      return NextResponse.json({ ok: true, path: filePath });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 400 });
    }
  });
}

// DELETE — delete a workspace file (participants only)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ threadId: string; path: string[] }> }
) {
  return withTenantFromRequest(request, async () => {
    const entity = await getAuthenticatedEntity(request);
    if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { threadId, path: pathSegments } = await params;

    const participantId = entity.type === "human" ? `human:${entity.id}` : `agent:${entity.id}`;
    if (!isParticipant(threadId, participantId)) {
      return NextResponse.json({ error: "You must join this thread to delete files" }, { status: 403 });
    }

    const filePath = pathSegments.join("/");

    try {
      const deleted = await deleteWorkspaceFile(threadId, filePath, entity.name);
      if (!deleted) return NextResponse.json({ error: "File not found" }, { status: 404 });
      return NextResponse.json({ ok: true });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 400 });
    }
  });
}
