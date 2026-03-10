import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { listRegisteredAgents } from "@/lib/git-storage";

export async function GET(request: Request) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const agents = listRegisteredAgents().map(({ token_hash: _, ...rest }) => rest);
  return NextResponse.json({ agents });
}
