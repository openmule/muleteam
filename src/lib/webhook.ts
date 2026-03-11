export interface WebhookPayload {
  event: "mention" | "reply" | "join" | "status_change" | "task_assigned" | "task_done";
  thread_id: string;
  thread_title: string;
  actor: string;
  summary: string;
  url: string;
  timestamp: string;
}

/**
 * Build a human-readable summary for a webhook event.
 */
export function buildSummary(
  event: WebhookPayload["event"],
  actorName: string,
  threadTitle: string,
  body?: string | null
): string {
  switch (event) {
    case "mention":
      return `${actorName} mentioned you in "${threadTitle}"`;
    case "reply":
      return `${actorName} replied to you in "${threadTitle}"`;
    case "join":
      return `${actorName} added you to "${threadTitle}"`;
    case "status_change":
      return `"${threadTitle}" marked as ${body ?? "updated"}`;
    case "task_assigned":
      return `${actorName} assigned you a task in "${threadTitle}"${body ? `: ${body}` : ""}`;
    case "task_done":
      return `${actorName} completed a task in "${threadTitle}"${body ? `: ${body}` : ""}`;
    default:
      return `New event in "${threadTitle}"`;
  }
}

const RETRY_DELAYS = [1000, 2000, 4000];

/**
 * Fire-and-forget POST to a webhook URL.
 * Retries up to 3 times with exponential backoff (1s, 2s, 4s).
 * Never throws — all errors are caught and logged silently.
 */
export async function sendWebhook(
  webhookUrl: string,
  payload: WebhookPayload
): Promise<void> {
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok || (res.status >= 200 && res.status < 300)) {
        return; // Success
      }
      // 4xx errors (except 429) are not retryable
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        console.warn(`Webhook ${webhookUrl} returned ${res.status}, not retrying`);
        return;
      }
      // 5xx or 429 — fall through to retry
    } catch {
      // Network error or timeout — fall through to retry
    }

    if (attempt < RETRY_DELAYS.length) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
    }
  }
  console.warn(`Webhook ${webhookUrl} failed after ${RETRY_DELAYS.length + 1} attempts`);
}
