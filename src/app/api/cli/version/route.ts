import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { withTenantFromRequest } from "@/lib/tenant-context";

// Extract CLI version from the shell script (source of truth)
function getCliVersion(): string {
  try {
    const cliPath = join(process.cwd(), "public", "cli", "muleteam");
    const content = readFileSync(cliPath, "utf-8");
    const match = content.match(/^MULETEAM_CLI_VERSION="([^"]+)"/m);
    return match?.[1] ?? "unknown";
  } catch {
    return "unknown";
  }
}

export async function GET(request: Request) {
  return withTenantFromRequest(request, async () => {
    return NextResponse.json({ version: getCliVersion() });
  });
}
