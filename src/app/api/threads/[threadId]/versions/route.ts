import { NextResponse } from "next/server";
import { getAuthenticatedEntity } from "@/lib/auth";
import { getArtifactVersions } from "@/lib/git-storage";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const entity = await getAuthenticatedEntity(request);
  if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { threadId } = await params;
  const versions = getArtifactVersions(threadId);
  return NextResponse.json({ versions });
}
