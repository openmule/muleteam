import { NextResponse } from "next/server";
import { getAuthenticatedEntity } from "@/lib/auth";
import { getMessages, addMessage, getThread, isParticipant, type Message } from "@/lib/git-storage";
import { nanoid } from "@/lib/utils";
import { emitMentionEvents, emitReplyEvent } from "@/lib/events";

// GET - list messages in thread (open to all authenticated users)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const entity = await getAuthenticatedEntity(request);
  if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { threadId } = await params;
  const thread = getThread(threadId);
  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

  const messages = getMessages(threadId);
  return NextResponse.json({ messages });
}

// POST - send a message (participants only)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const entity = await getAuthenticatedEntity(request);
  if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { threadId } = await params;
  const thread = getThread(threadId);
  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

  const participantId = entity.type === "human" ? `human:${entity.id}` : `agent:${entity.id}`;
  if (!isParticipant(threadId, participantId)) {
    return NextResponse.json({ error: "You must join this thread to post messages" }, { status: 403 });
  }

  const { body, reply_to } = await request.json();
  if (!body?.trim()) return NextResponse.json({ error: "Message body is required" }, { status: 400 });

  const message: Message = {
    id: nanoid(),
    ts: Date.now(),
    from: participantId,
    from_name: entity.name,
    type: "text",
    body: body.trim(),
    ...(reply_to ? { reply_to } : {}),
  };

  addMessage(threadId, message);

  // Fire-and-forget: emit notification events
  const threadMeta = getThread(threadId);
  if (threadMeta) {
    emitMentionEvents(threadId, threadMeta.title, message, threadMeta.participants);

    if (reply_to) {
      const allMessages = getMessages(threadId);
      const originalMessage = allMessages.find((m) => m.id === reply_to);
      if (originalMessage) {
        emitReplyEvent(threadId, threadMeta.title, message, originalMessage);
      }
    }
  }

  return NextResponse.json({ message }, { status: 201 });
}
