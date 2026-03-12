import { NextResponse } from "next/server";
import { getAuthenticatedEntity } from "@/lib/auth";
import { getThread, getThreadTasks, addThreadTask, isParticipant, type ActionItem } from "@/lib/git-storage";
import { nanoid } from "@/lib/utils";
import { emitTaskAssignedEvent } from "@/lib/events";
import { withTenantFromRequest } from "@/lib/tenant-context";

// GET — list tasks (open to all authenticated users)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  return withTenantFromRequest(request, async () => {
    const entity = await getAuthenticatedEntity(request);
    if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { threadId } = await params;
    const tasks = getThreadTasks(threadId);
    return NextResponse.json({ tasks });
  });
}

// POST — create a new task (participants only)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  return withTenantFromRequest(request, async () => {
    const entity = await getAuthenticatedEntity(request);
    if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { threadId } = await params;

    const participantId = entity.type === "human" ? `human:${entity.id}` : `agent:${entity.id}`;
    if (!isParticipant(threadId, participantId)) {
      return NextResponse.json({ error: "You must join this thread to add tasks" }, { status: 403 });
    }

    const { description, assignee, source_message_id } = await request.json();

    if (!description || typeof description !== "string" || !description.trim()) {
      return NextResponse.json({ error: "Description is required" }, { status: 400 });
    }

    // Resolve assignee name from thread participants
    let assignee_name: string | undefined;
    if (assignee) {
      const thread = getThread(threadId);
      const participant = thread?.participants.find(p => p.id === assignee);
      assignee_name = participant?.name;
    }

    const now = new Date().toISOString();
    const task: ActionItem = {
      id: `task_${nanoid()}`,
      description: description.trim(),
      assignee: assignee || undefined,
      assignee_name,
      status: "open",
      created_by: participantId,
      created_by_name: entity.name,
      created_at: now,
      updated_at: now,
      source_message_id: source_message_id || undefined,
    };

    addThreadTask(threadId, task);

    // Fire-and-forget: emit task_assigned event if assignee is set and different from creator
    if (task.assignee && task.assignee !== participantId) {
      const thread = getThread(threadId);
      if (thread) {
        emitTaskAssignedEvent(threadId, thread.title, task, participantId, entity.name);
      }
    }

    return NextResponse.json({ task }, { status: 201 });
  });
}
