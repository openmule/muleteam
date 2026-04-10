import { NextRequest, NextResponse } from "next/server"
import { readFileSync } from "fs"
import { join } from "path"

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path")
  const allowedPaths = [".claude/skills/", "CLAUDE.md"]
  const isAllowed = path && (allowedPaths.includes(path) || (path.startsWith(".claude/skills/") && path.endsWith(".md")))
  if (!isAllowed) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 })
  }
  try {
    const fullPath = join(process.cwd(), path)
    const content = readFileSync(fullPath, "utf-8")
    return new NextResponse(content, { headers: { "Content-Type": "text/plain; charset=utf-8" } })
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }
}
