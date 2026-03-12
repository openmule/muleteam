import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { sendWebhook, type WebhookPayload } from "@/lib/webhook";
import { withTenantFromRequest } from "@/lib/tenant-context";

export async function GET(request: Request) {
  return withTenantFromRequest(request, async () => {
    try {
      const user = await getUser(request);
      if (!user) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      }

      const sql = await db();
      const result = (await sql`
        SELECT webhook_url FROM users WHERE id = ${user.id}
      `) as { webhook_url: string | null }[];

      return NextResponse.json({
        webhook_url: result[0]?.webhook_url ?? null,
      });
    } catch (error) {
      console.error("GET webhook error:", error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  });
}

export async function PATCH(request: Request) {
  return withTenantFromRequest(request, async () => {
    try {
      const user = await getUser(request);
      if (!user) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      }

      const body = await request.json();
      const webhookUrl = typeof body.webhook_url === "string" ? body.webhook_url.trim() : null;

      // Validate URL if not empty
      if (webhookUrl && webhookUrl.length > 0) {
        try {
          const parsed = new URL(webhookUrl);
          if (!["http:", "https:"].includes(parsed.protocol)) {
            return NextResponse.json({ error: "URL must use http or https" }, { status: 400 });
          }
        } catch {
          return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
        }
      }

      const sql = await db();
      const urlValue = webhookUrl && webhookUrl.length > 0 ? webhookUrl : null;
      await sql`UPDATE users SET webhook_url = ${urlValue} WHERE id = ${user.id}`;

      return NextResponse.json({ ok: true, webhook_url: urlValue });
    } catch (error) {
      console.error("PATCH webhook error:", error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  });
}

export async function POST(request: Request) {
  return withTenantFromRequest(request, async () => {
    try {
      const user = await getUser(request);
      if (!user) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      }

      const sql = await db();
      const result = (await sql`
        SELECT webhook_url FROM users WHERE id = ${user.id}
      `) as { webhook_url: string | null }[];

      const webhookUrl = result[0]?.webhook_url;
      if (!webhookUrl) {
        return NextResponse.json({ error: "No webhook URL configured" }, { status: 400 });
      }

      const testPayload: WebhookPayload = {
        event: "mention",
        thread_id: "test",
        thread_title: "Test Thread",
        actor: "MuleTeam",
        summary: "This is a test notification from MuleTeam",
        url: new URL("/", request.url).toString(),
        timestamp: new Date().toISOString(),
      };

      // For test, we actually await and report success/failure
      try {
        const res = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(testPayload),
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) {
          return NextResponse.json(
            { error: `Webhook returned ${res.status}` },
            { status: 502 }
          );
        }
        return NextResponse.json({ ok: true });
      } catch (err) {
        return NextResponse.json(
          { error: "Failed to reach webhook URL" },
          { status: 502 }
        );
      }
    } catch (error) {
      console.error("POST webhook test error:", error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  });
}
