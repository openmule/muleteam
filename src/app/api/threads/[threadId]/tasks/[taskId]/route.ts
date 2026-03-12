import { NextResponse } from "next/server";
import { getAuthenticatedEntity } from "@/lib/auth";
import { getThread, getThreadTasks, updateThreadTask, deleteThreadTask, isParticipant } from "@/lib/git-storage";
import { emitTaskAssignedEvent, emitTaskDoneEvent } from "@/lib/events";
import { withTenantFromRequest } from "@/lib/tenant-context";

// PATCH — update a task (participants only)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ threadId: string; taskId: string }> }
) {
  return withTenantFromRequest(request, async () => {
    const entity = await getAuthenticatedEntity(request);
    if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { threadId, taskId } = await params;

    const participantId = entity.type === "human" ? `human:${entity.id}` : `agent:${entity.id}`;
    if (!isParticipant(threadId, participantId)) {
      return NextResponse.json({ error: "You must join this thread to update tasks" }, { status: 403 });
    }

    const body = await request.json();
    const { status, assignee, description } = body;

    if (status && !["open", "in_progress", "done"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    // Get old task state for event comparison
    const oldTasks = getThreadTasks(threadId);
    const oldTask = oldTasks.find(t => t.id === taskId);
    if (!oldTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Resolve assignee name if assignee is changing
    const updates: Record<string, unknown> = {};
    if (status !== undefined) updates.status = status;
    if (description !== undefined) updates.description = description;
    if (assignee !== undefined) {
      updates.assignee = assignee || undefined;
      if (assignee) {
        const thread = getThread(threadId);
        const participant = thread?.participants.find(p => p.id === assignee);
        updates.assignee_name = participant?.name;
      } else {
        updates.assignee_name = undefined;
      }
    }

    const task = updateThreadTask(threadId, taskId, updates);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Fire-and-forget: emit events
    const thread = getThread(threadId);
    if (thread) {
      // Emit task_done event if status changed to done
      if (status === "done" && oldTask.status !== "done") {
        emitTaskDoneEvent(threadId, thread.title, task, participantId, entity.name);
      }

      // Emit task_assigned event if assignee changed
      if (assignee !== undefined && assignee !== oldTask.assignee && assignee) {
        emitTaskAssignedEvent(threadId, thread.title, task, participantId, entity.name);
      }
    }

    return NextResponse.json({ task });
  });
}

// DELETE — remove a task (participants only)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ threadId: string; taskId: string }> }
) {
  return withTenantFromRequest(request, async () => {
    const entity = await getAuthenticatedEntity(request);
    if (!entity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { threadId, taskId } = await params;

    const participantId = entity.type === "human" ? `human:${entity.id}` : `agent:${entity.id}`;
    if (!isParticipant(threadId, participantId)) {
      return NextResponse.json({ error: "You must join this thread to delete tasks" }, { status: 403 });
    }

    const deleted = deleteThreadTask(threadId, taskId);
    if (!deleted) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  });
}
