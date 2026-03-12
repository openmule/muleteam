import { NextResponse } from "next/server";
import { getAuthenticatedEntity } from "@/lib/auth";
import { getLinks, addLink, isParticipant, type HyperlinkEntry } from "@/lib/git-storage";
import { nanoid } from "@/lib/utils";
import { withTenantFromRequest } from "@/lib/tenant-context";

// GET — list links (open to all authenticated users)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  return withTenantFromRequest(request, async () => {
    const entity = await getAuthenticatedEntity(request);
    if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { threadId } = await params;
    const links = getLinks(threadId);
    return NextResponse.json({ links });
  });
}

// POST — add a link (participants only)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  return withTenantFromRequest(request, async () => {
    const entity = await getAuthenticatedEntity(request);
    if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { threadId } = await params;

    const participantId = entity.type === "human" ? `human:${entity.id}` : `agent:${entity.id}`;
    if (!isParticipant(threadId, participantId)) {
      return NextResponse.json({ error: "You must join this thread to add links" }, { status: 403 });
    }

    const { url, title, type } = await request.json();

    if (!url) return NextResponse.json({ error: "URL is required" }, { status: 400 });

    // Only allow http/https URLs to prevent javascript: / data: XSS
    if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: "Only http and https URLs are allowed" }, { status: 400 });
    }

    const link: HyperlinkEntry = {
      id: `link_${nanoid()}`,
      url,
      title: title || url,
      type: type || (url.startsWith("/") ? "demo" : "external"),
      added_by: entity.name,
      added_at: new Date().toISOString(),
    };

    addLink(threadId, link);
    return NextResponse.json({ link }, { status: 201 });
  });
}
