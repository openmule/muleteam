import { NextResponse } from "next/server";
import { getArtifact, readWorkspaceFile } from "@/lib/git-storage";

// GET - serve artifact HTML or workspace HTML file
// ?version=N for specific artifact version
// ?file=filename for workspace file
export async function GET(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const { threadId } = await params;
  const url = new URL(request.url);

  // Serve workspace file if ?file= is specified
  const fileParam = url.searchParams.get("file");
  if (fileParam) {
    try {
      const content = readWorkspaceFile(threadId, fileParam);
      if (content) {
        const ext = fileParam.split(".").pop()?.toLowerCase();
        const contentType = ext === "html" || ext === "htm"
          ? "text/html; charset=utf-8"
          : "text/plain; charset=utf-8";
        return new NextResponse(content, {
          headers: { "Content-Type": contentType },
        });
      }
    } catch {
      // Fall through to not found
    }
  }

  // Serve artifact
  const versionParam = url.searchParams.get("version");
  const version = versionParam ? parseInt(versionParam) : undefined;

  const html = getArtifact(threadId, version);
  if (!html) {
    return new NextResponse(
      `<!DOCTYPE html><html><head><style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui;color:#999;background:#fafafa}</style></head>
       <body>
         <div style="text-align:center">
           <p style="font-size:2rem;margin-bottom:1rem">No preview yet</p>
           <p style="font-size:0.875rem">Files will appear here when agents create them</p>
         </div>
       </body></html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
