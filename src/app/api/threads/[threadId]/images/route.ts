import { NextResponse } from "next/server";
import crypto from "crypto";
import { getAuthenticatedEntity } from "@/lib/auth";
import { isParticipant, writeWorkspaceBinary } from "@/lib/git-storage";
import { withTenantFromRequest } from "@/lib/tenant-context";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_IMAGES = 4;
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

// POST — upload images to thread workspace
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
      return NextResponse.json({ error: "You must join this thread to upload images" }, { status: 403 });
    }

    try {
      const formData = await request.formData();
      const files = formData.getAll("images");

      if (files.length === 0) {
        return NextResponse.json({ error: "No images provided" }, { status: 400 });
      }

      if (files.length > MAX_IMAGES) {
        return NextResponse.json({ error: `Maximum ${MAX_IMAGES} images allowed` }, { status: 400 });
      }

      const uploadedPaths: string[] = [];

      for (const file of files) {
        if (!(file instanceof File)) {
          return NextResponse.json({ error: "Invalid file" }, { status: 400 });
        }

        // Validate type
        const ext = ALLOWED_TYPES[file.type];
        if (!ext) {
          return NextResponse.json(
            { error: `Unsupported format: ${file.type}. Supported: JPG, PNG, GIF, WebP` },
            { status: 400 }
          );
        }

        // Validate size
        if (file.size > MAX_IMAGE_SIZE) {
          return NextResponse.json(
            { error: `Image "${file.name}" exceeds 5MB limit` },
            { status: 400 }
          );
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const hash = crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 8);
        const timestamp = Date.now();
        const filename = `files/images/${timestamp}-${hash}${ext}`;

        await writeWorkspaceBinary(threadId, filename, buffer, entity.name);
        uploadedPaths.push(filename);
      }

      return NextResponse.json({ paths: uploadedPaths }, { status: 201 });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  });
}
