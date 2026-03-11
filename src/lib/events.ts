import { db } from "@/lib/db";
import type { Participant, ActionItem } from "@/lib/git-storage";
import { sendWebhook, buildSummary, type WebhookPayload } from "@/lib/webhook";

interface MessageLike {
  id: string;
  from: string;
  from_name: string;
  body: string;
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 14);
}

/** Resolve the public URL for a thread. */
function threadUrl(threadId: string): string {
  const base = process.env.NEXT_PUBLIC_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
    || "https://team.oreasono.com";
  return `${base}/thread/${threadId}`;
}

/**
 * Look up a user's webhook_url by their participant-style ID (e.g. "human:abc123").
 * Only human users can have webhooks — agents are skipped.
 */
async function getUserWebhookUrl(participantId: string): Promise<string | null> {
  if (!participantId.startsWith("human:")) return null;
  const rawId = participantId.slice("human:".length);
  try {
    const sql = db();
    const rows = (await sql`
      SELECT webhook_url FROM users WHERE id = ${rawId}
    `) as { webhook_url: string | null }[];
    return rows[0]?.webhook_url ?? null;
  } catch {
    return null;
  }
}

/**
 * Fire-and-forget: look up user's webhook_url, and if set, send the webhook.
 * Never blocks the caller.
 */
function dispatchWebhook(
  userId: string,
  event: WebhookPayload["event"],
  threadId: string,
  threadTitle: string,
  actorName: string,
  body?: string | null
): void {
  // Run entirely in the background — never block the caller
  getUserWebhookUrl(userId).then((url) => {
    if (!url) return;
    const payload: WebhookPayload = {
      event,
      thread_id: threadId,
      thread_title: threadTitle,
      actor: actorName,
      summary: buildSummary(event, actorName, threadTitle, body),
      url: threadUrl(threadId),
      timestamp: new Date().toISOString(),
    };
    sendWebhook(url, payload);
  }).catch(() => {
    // Silently ignore — webhook is best-effort
  });
}

/**
 * Match @Name mentions in message body against thread participants.
 * Returns matched participant IDs (excluding the sender).
 */
export function parseMentions(
  body: string,
  participants: Participant[],
  senderId: string
): string[] {
  const matched: string[] = [];
  for (const p of participants) {
    if (p.id === senderId) continue;
    // Match @Name (case-insensitive) — the name could appear as @FirstName or @FullName
    const escaped = p.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`@${escaped}\\b`, "i");
    if (regex.test(body)) {
      matched.push(p.id);
    }
  }
  return matched;
}

/**
 * Emit mention events for all @-mentioned participants in a message.
 * Fire-and-forget — errors are caught and logged.
 */
export async function emitMentionEvents(
  threadId: string,
  threadTitle: string,
  message: MessageLike,
  participants: Participant[]
): Promise<void> {
  try {
    const mentionedIds = parseMentions(message.body, participants, message.from);
    if (mentionedIds.length === 0) return;

    const sql = db();
    for (const userId of mentionedIds) {
      const id = generateId();
      await sql`
        INSERT INTO events (id, user_id, type, thread_id, thread_title, message_id, actor_id, actor_name, body)
        VALUES (${id}, ${userId}, ${"mention"}, ${threadId}, ${threadTitle}, ${message.id}, ${message.from}, ${message.from_name}, ${message.body})
      `;
      dispatchWebhook(userId, "mention", threadId, threadTitle, message.from_name, message.body);
    }
  } catch (err) {
    console.error("Failed to emit mention events:", err);
  }
}

/**
 * Emit a reply event when someone replies to another user's message.
 * Fire-and-forget — errors are caught and logged.
 */
export async function emitReplyEvent(
  threadId: string,
  threadTitle: string,
  message: MessageLike,
  originalMessage: MessageLike
): Promise<void> {
  try {
    // Don't notify if replying to yourself
    if (originalMessage.from === message.from) return;

    const sql = db();
    const id = generateId();
    await sql`
      INSERT INTO events (id, user_id, type, thread_id, thread_title, message_id, actor_id, actor_name, body)
      VALUES (${id}, ${originalMessage.from}, ${"reply"}, ${threadId}, ${threadTitle}, ${message.id}, ${message.from}, ${message.from_name}, ${message.body})
    `;
    dispatchWebhook(originalMessage.from, "reply", threadId, threadTitle, message.from_name, message.body);
  } catch (err) {
    console.error("Failed to emit reply event:", err);
  }
}

/**
 * Emit a join event when someone is added to a thread by another user.
 * Fire-and-forget — errors are caught and logged.
 */
export async function emitJoinEvent(
  threadId: string,
  threadTitle: string,
  addedId: string,
  actorId: string,
  actorName: string
): Promise<void> {
  try {
    const sql = db();
    const id = generateId();
    await sql`
      INSERT INTO events (id, user_id, type, thread_id, thread_title, message_id, actor_id, actor_name, body)
      VALUES (${id}, ${addedId}, ${"join"}, ${threadId}, ${threadTitle}, ${null}, ${actorId}, ${actorName}, ${null})
    `;
    dispatchWebhook(addedId, "join", threadId, threadTitle, actorName);
  } catch (err) {
    console.error("Failed to emit join event:", err);
  }
}

/**
 * Emit status change events to all participants (except the actor).
 * Fire-and-forget — errors are caught and logged.
 */
export async function emitStatusChangeEvent(
  threadId: string,
  threadTitle: string,
  newStatus: string,
  actorId: string,
  actorName: string,
  participantIds: string[]
): Promise<void> {
  try {
    const sql = db();
    for (const userId of participantIds) {
      if (userId === actorId) continue;
      const id = generateId();
      await sql`
        INSERT INTO events (id, user_id, type, thread_id, thread_title, message_id, actor_id, actor_name, body)
        VALUES (${id}, ${userId}, ${"status_change"}, ${threadId}, ${threadTitle}, ${null}, ${actorId}, ${actorName}, ${newStatus})
      `;
      dispatchWebhook(userId, "status_change", threadId, threadTitle, actorName, newStatus);
    }
  } catch (err) {
    console.error("Failed to emit status change events:", err);
  }
}

/**
 * Emit a task_assigned event when someone is assigned a task.
 * Fire-and-forget — errors are caught and logged.
 */
export async function emitTaskAssignedEvent(
  threadId: string,
  threadTitle: string,
  task: ActionItem,
  actorId: string,
  actorName: string
): Promise<void> {
  try {
    if (!task.assignee || task.assignee === actorId) return;

    const sql = db();
    const id = generateId();
    await sql`
      INSERT INTO events (id, user_id, type, thread_id, thread_title, message_id, actor_id, actor_name, body)
      VALUES (${id}, ${task.assignee}, ${"task_assigned"}, ${threadId}, ${threadTitle}, ${null}, ${actorId}, ${actorName}, ${task.description})
    `;
    dispatchWebhook(task.assignee!, "task_assigned", threadId, threadTitle, actorName, task.description);
  } catch (err) {
    console.error("Failed to emit task assigned event:", err);
  }
}

/**
 * Emit a task_done event when a task is marked as done.
 * Notifies the task creator (unless the actor is the creator).
 * Fire-and-forget — errors are caught and logged.
 */
export async function emitTaskDoneEvent(
  threadId: string,
  threadTitle: string,
  task: ActionItem,
  actorId: string,
  actorName: string
): Promise<void> {
  try {
    if (task.created_by === actorId) return;

    const sql = db();
    const id = generateId();
    await sql`
      INSERT INTO events (id, user_id, type, thread_id, thread_title, message_id, actor_id, actor_name, body)
      VALUES (${id}, ${task.created_by}, ${"task_done"}, ${threadId}, ${threadTitle}, ${null}, ${actorId}, ${actorName}, ${task.description})
    `;
    dispatchWebhook(task.created_by!, "task_done", threadId, threadTitle, actorName, task.description);
  } catch (err) {
    console.error("Failed to emit task done event:", err);
  }
}
