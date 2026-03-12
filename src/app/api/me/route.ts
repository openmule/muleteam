import { NextResponse } from "next/server";
import { getAuthenticatedEntity } from "@/lib/auth";
import { withTenantFromRequest } from "@/lib/tenant-context";

export async function GET(request: Request) {
  return withTenantFromRequest(request, async () => {
    const entity = await getAuthenticatedEntity(request);
    if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    return NextResponse.json({
      id: entity.id,
      name: entity.name,
      type: entity.type,
    });
  });
}
