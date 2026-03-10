import { db } from "@/lib/db";
import type { Participant, ActionItem } from "@/lib/git-storage";

interface MessageLike {
  id: string;
  from: string;
  from_name: string;
  body: string;
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 14);
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
  } catch (err) {
    console.error("Failed to emit task done event:", err);
  }
}
