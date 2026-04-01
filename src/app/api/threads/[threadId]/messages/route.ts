import { NextResponse } from "next/server";
import { getAuthenticatedEntity } from "@/lib/auth";
import { getMessages, addMessage, getThread, isParticipant, getGitHead, readWorkspaceFile, type Message, type AnnotationAnchor } from "@/lib/git-storage";
import { nanoid } from "@/lib/utils";
import { emitMentionEvents, emitReplyEvent } from "@/lib/events";
import { withTenantFromRequest } from "@/lib/tenant-context";

/**
 * Parse annotation syntax from message body.
 * Formats:
 *   📌 file.md:L10 comment text
 *   📌 file.md:L10-15 comment text
 *   📌 file.html:div.hero>h1 comment text
 *   📌 file.html:.class-name comment text
 *
 * Returns parsed annotations + remaining text (non-annotation lines).
 */
function parseAnnotationSyntax(
  body: string,
  threadId: string
): { annotations: { filePath: string; anchor: Omit<AnnotationAnchor, "commit_hash">; comment: string }[]; remainingText: string } {
  const annotations: { filePath: string; anchor: Omit<AnnotationAnchor, "commit_hash">; comment: string }[] = [];
  const otherLines: string[] = [];

  // Match: 📌 file:anchor comment
  const ANNOTATION_RE = /^📌\s+(\S+?):(\S+)\s+(.+)$/;

  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    const match = trimmed.match(ANNOTATION_RE);
    if (!match) {
      otherLines.push(line);
      continue;
    }

    const [, filePath, anchorStr, comment] = match;

    // Parse anchor: L10, L10-15 (line), or CSS selector
    const lineMatch = anchorStr.match(/^L(\d+)(?:-(\d+))?$/);
    if (lineMatch) {
      const startLine = parseInt(lineMatch[1]);
      const endLine = lineMatch[2] ? parseInt(lineMatch[2]) : startLine;

      // Get content snapshot from file
      const fileContent = readWorkspaceFile(threadId, filePath);
      const lines = fileContent?.split("\n") ?? [];
      const snapshot = lines.slice(startLine - 1, endLine).join("\n").slice(0, 200);

      annotations.push({
        filePath,
        anchor: {
          file_path: filePath,
          anchor_type: "line",
          start_line: startLine,
          end_line: endLine,
          content_snapshot: snapshot || `Line ${startLine}`,
        },
        comment,
      });
    } else {
      // Treat as CSS selector
      const selector = anchorStr;

      // For selectors, we can't easily get content snapshot server-side
      // Use the selector as snapshot placeholder
      annotations.push({
        filePath,
        anchor: {
          file_path: filePath,
          anchor_type: "selector",
          selector,
          content_snapshot: selector,
        },
        comment,
      });
    }
  }

  return { annotations, remainingText: otherLines.join("\n").trim() };
}

// GET - list messages in thread (open to all authenticated users)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  return withTenantFromRequest(request, async () => {
    const entity = await getAuthenticatedEntity(request);
    if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { threadId } = await params;
    const thread = getThread(threadId);
    if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

    const messages = getMessages(threadId);
    return NextResponse.json({ messages });
  });
}

// POST - send a message (participants only)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  return withTenantFromRequest(request, async () => {
    const entity = await getAuthenticatedEntity(request);
    if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { threadId } = await params;
    const thread = getThread(threadId);
    if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

    const participantId = entity.type === "human" ? `human:${entity.id}` : `agent:${entity.id}`;
    if (!isParticipant(threadId, participantId)) {
      return NextResponse.json({ error: "You must join this thread to post messages" }, { status: 403 });
    }

    const { body, reply_to, annotation } = await request.json();
    if (!body?.trim()) return NextResponse.json({ error: "Message body is required" }, { status: 400 });

    const commitHash = getGitHead();
    const createdMessages: Message[] = [];

    // If explicit annotation payload is provided (from UI), use it directly
    if (annotation) {
      const { file_path, anchor_type, start_line, end_line, selector, content_snapshot } = annotation;
      if (!file_path || !anchor_type || !content_snapshot) {
        return NextResponse.json({ error: "Annotation requires file_path, anchor_type, and content_snapshot" }, { status: 400 });
      }
      const annotationData: AnnotationAnchor = {
        file_path,
        anchor_type,
        ...(start_line !== undefined ? { start_line } : {}),
        ...(end_line !== undefined ? { end_line } : {}),
        ...(selector ? { selector } : {}),
        commit_hash: commitHash,
        content_snapshot,
      };

      const message: Message = {
        id: nanoid(),
        ts: Date.now(),
        from: participantId,
        from_name: entity.name,
        type: "annotation",
        body: body.trim(),
        ...(reply_to ? { reply_to } : {}),
        annotation: annotationData,
      };

      addMessage(threadId, message);
      createdMessages.push(message);
    } else {
      // Try to parse annotation syntax from body (agent CLI support)
      const { annotations, remainingText } = parseAnnotationSyntax(body.trim(), threadId);

      if (annotations.length > 0) {
        // Create individual annotation messages
        const ts = Date.now();
        for (let i = 0; i < annotations.length; i++) {
          const ann = annotations[i];
          const message: Message = {
            id: nanoid(),
            ts: ts + i, // Ensure ordering
            from: participantId,
            from_name: entity.name,
            type: "annotation",
            body: ann.comment,
            annotation: { ...ann.anchor, commit_hash: commitHash },
          };
          addMessage(threadId, message);
          createdMessages.push(message);
        }

        // Create regular text message for remaining non-annotation content
        if (remainingText) {
          const textMessage: Message = {
            id: nanoid(),
            ts: ts + annotations.length,
            from: participantId,
            from_name: entity.name,
            type: "text",
            body: remainingText,
            ...(reply_to ? { reply_to } : {}),
          };
          addMessage(threadId, textMessage);
          createdMessages.push(textMessage);
        }
      } else {
        // No annotations found — regular text message
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
        createdMessages.push(message);
      }
    }

    // Fire-and-forget: emit notification events for each created message
    const threadMeta = getThread(threadId);
    if (threadMeta) {
      for (const message of createdMessages) {
        let replyTargetId: string | undefined;
        if (message.reply_to) {
          const allMessages = getMessages(threadId);
          const originalMessage = allMessages.find((m) => m.id === message.reply_to);
          if (originalMessage) {
            replyTargetId = originalMessage.from;
            emitReplyEvent(threadId, threadMeta.title, message, originalMessage);
          }
        }
        emitMentionEvents(
          threadId, threadMeta.title, message, threadMeta.participants,
          replyTargetId ? [replyTargetId] : undefined
        );
      }
    }

    // Return first message (or all if batch)
    if (createdMessages.length === 1) {
      return NextResponse.json({ message: createdMessages[0] }, { status: 201 });
    }
    return NextResponse.json({ messages: createdMessages, count: createdMessages.length }, { status: 201 });
  });
}
