import { NextResponse } from "next/server";
import { getAuthenticatedEntity } from "@/lib/auth";
import { readWorkspaceFile, writeWorkspaceFile, deleteWorkspaceFile, isParticipant } from "@/lib/git-storage";

// GET — read a workspace file (open to all authenticated users)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ threadId: string; path: string[] }> }
) {
  const entity = await getAuthenticatedEntity(request);
  if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { threadId, path: pathSegments } = await params;
  const filePath = pathSegments.join("/");

  try {
    const content = readWorkspaceFile(threadId, filePath);
    if (content === null) return NextResponse.json({ error: "File not found" }, { status: 404 });
    return NextResponse.json({ content, path: filePath });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}

// PUT — write a workspace file (participants only)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ threadId: string; path: string[] }> }
) {
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
}

// DELETE — delete a workspace file (participants only)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ threadId: string; path: string[] }> }
) {
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
}
