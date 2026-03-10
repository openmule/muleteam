"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n";
import { MemberAvatar } from "@/components/shared/MemberAvatar";
import { timeAgo } from "@/components/shared/helpers";

interface ActionItem {
  id: string;
  description: string;
  assignee?: string;
  assignee_name?: string;
  status: "open" | "in_progress" | "done";
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  source_message_id?: string;
}

interface Participant {
  id: string;
  type: "human" | "agent";
  name: string;
}

export function ActionItems({
  threadId,
  tasks,
  participants,
  onRefresh,
  readOnly = false,
}: {
  threadId: string;
  tasks: ActionItem[];
  participants: Participant[];
  onRefresh: () => void;
  readOnly?: boolean;
}) {
  const t = useT();
  const [expanded, setExpanded] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newDesc, setNewDesc] = useState("");
  const [newAssignee, setNewAssignee] = useState("");
  const [adding, setAdding] = useState(false);

  // Sort: open/in_progress first, then done
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.status === "done" && b.status !== "done") return 1;
    if (a.status !== "done" && b.status === "done") return -1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  const openCount = tasks.filter(t => t.status !== "done").length;

  const handleAdd = async () => {
    if (!newDesc.trim()) return;
    setAdding(true);
    try {
      await fetch(`/api/threads/${threadId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: newDesc.trim(),
          assignee: newAssignee || undefined,
        }),
      });
      setNewDesc("");
      setNewAssignee("");
      setShowAdd(false);
      onRefresh();
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (task: ActionItem) => {
    const newStatus = task.status === "done" ? "open" : "done";
    await fetch(`/api/threads/${threadId}/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    onRefresh();
  };

  const assigneeType = (id: string): "human" | "agent" =>
    id.startsWith("agent:") ? "agent" : "human";

  return (
    <div className="border-b border-border">
      <button
        className="flex items-center justify-between w-full px-4 py-3 text-left text-sm font-medium hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          {t("sidebar.actionItems")}
          {openCount > 0 && (
            <span className="ml-1 text-xs text-muted-foreground">({openCount})</span>
          )}
        </span>
        <span className="text-xs text-muted-foreground">{expanded ? "\u25B4" : "\u25BE"}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-1">
          {sortedTasks.length === 0 && !showAdd && (
            <p className="text-xs text-muted-foreground py-2">{t("sidebar.noTasks")}</p>
          )}

          {sortedTasks.map((task) => (
            <div key={task.id} className="flex items-start gap-2 py-1 group">
              {/* Checkbox */}
              {!readOnly ? (
                <button
                  onClick={() => handleToggle(task)}
                  className="shrink-0 mt-0.5 w-4 h-4 rounded border border-border flex items-center justify-center hover:bg-muted/50 transition-colors"
                  title={task.status === "done" ? "Reopen" : "Mark done"}
                >
                  {task.status === "done" && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ) : (
                <span className="shrink-0 mt-0.5 w-4 h-4 rounded border border-border flex items-center justify-center">
                  {task.status === "done" && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </span>
              )}

              {/* Description and meta */}
              <div className="flex-1 min-w-0">
                <span className={`text-sm ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                  {task.description}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {task.assignee_name && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MemberAvatar
                        type={assigneeType(task.assignee!)}
                        name={task.assignee_name}
                        size={14}
                      />
                      {task.assignee_name}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {timeAgo(task.updated_at)}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {!readOnly && (showAdd ? (
            <div className="mt-2 space-y-2 rounded-md border border-border p-3">
              <Input
                placeholder="Task description..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="text-sm h-8"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
              />
              <select
                value={newAssignee}
                onChange={(e) => setNewAssignee(e.target.value)}
                className="w-full text-sm h-8 rounded-md border border-border bg-background px-2"
              >
                <option value="">No assignee</option>
                {participants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.type === "agent" ? `@${p.name}` : p.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAdd} disabled={adding || !newDesc.trim()}>
                  {adding ? "..." : t("common.add")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowAdd(false); setNewDesc(""); setNewAssignee(""); }}>
                  {t("common.cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <button
              className="text-xs text-muted-foreground hover:text-foreground mt-1"
              onClick={() => setShowAdd(true)}
            >
              {t("sidebar.addTask")}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
