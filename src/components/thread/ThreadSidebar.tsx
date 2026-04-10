"use client";

import { useState, useEffect, useRef } from "react";
import {
  ChevronDown, Users, SquareCheckBig, Files, Link2,
  GitCommitHorizontal, Plus, ArrowUpRight, Square, SquareCheck,
  Trash2, Upload, Loader2,
} from "lucide-react";
import { MemberAvatar } from "@/components/shared/MemberAvatar";
import { memberUrl } from "@/components/shared/helpers";
import { useRouter } from "next/navigation";
import { Pictogram } from "@/components/ui/pictogram";
import { useT } from "@/lib/i18n";

interface ThreadSidebarProps {
  threadId: string;
  description?: string;
  participants: { id: string; type: "human" | "agent"; name: string }[];
  tasks: any[];
  files: any[];
  links: any[];
  agents: any[];
  users: any[];
  isMember: boolean;
  onRefreshThread: () => void;
  onRefreshTasks: () => void;
  onRefreshFiles: () => void;
  onRefreshLinks: () => void;
}

function SectionHeader({
  icon: Icon,
  title,
  count,
  open,
  onToggle,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  count?: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center justify-between w-full h-12 px-3 rounded-[8px] hover:bg-[var(--fill-quaternary)] transition-colors cursor-pointer"
    >
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-[var(--label-primary)]" strokeWidth={1.5} />
        <div className="flex items-center gap-1 text-sm">
          <span className="font-semibold text-[var(--label-primary)]">{title}</span>
          {count && <span className="text-[var(--label-secondary)]">({count})</span>}
        </div>
      </div>
      <ChevronDown
        className={`size-4 text-[var(--label-secondary)] transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
        strokeWidth={1.5}
      />
    </button>
  );
}

function Divider() {
  return (
    <div className="mx-3 my-1">
      <div className="h-px bg-[var(--border-color-secondary)]" />
    </div>
  );
}

function Collapsible({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div className="collapse-wrapper" data-open={open}>
      <div className="collapse-inner">{children}</div>
    </div>
  );
}

/** Map file extension to pictogram name */
function getFilePictogram(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (["md", "txt", "log"].includes(ext)) return "file-code";
  if (["doc", "docx"].includes(ext)) return "file-document";
  if (["pdf"].includes(ext)) return "file-pdf";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "file-image";
  if (["xls", "xlsx", "csv"].includes(ext)) return "file-spreadsheet";
  if (["ppt", "pptx", "key"].includes(ext)) return "file-presentation";
  if (["js", "ts", "tsx", "jsx", "py", "go", "rs"].includes(ext)) return "file-code";
  return "file-file";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function ThreadSidebar({
  threadId,
  description,
  participants,
  tasks,
  files,
  links,
  agents,
  users,
  isMember,
  onRefreshThread,
  onRefreshTasks,
  onRefreshFiles,
  onRefreshLinks,
}: ThreadSidebarProps) {
  const [participantsOpen, setParticipantsOpen] = useState(true);
  const router = useRouter();
  const t = useT();
  const [actionsOpen, setActionsOpen] = useState(true);
  const [filesOpen, setFilesOpen] = useState(true);
  const [linksOpen, setLinksOpen] = useState(true);
  const [gitOpen, setGitOpen] = useState(true);

  // Action items state
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskAssignee, setNewTaskAssignee] = useState("");
  const [addingTask, setAddingTask] = useState(false);

  // File upload state
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openTaskCount = tasks.filter((t) => t.status !== "done").length;
  const totalFileSize = files.reduce((sum: number, f: any) => sum + (f.size || 0), 0);

  // Sort tasks: open/in_progress first, then done
  const sortedTasks = [...tasks].sort((a: any, b: any) => {
    if (a.status === "done" && b.status !== "done") return 1;
    if (a.status !== "done" && b.status === "done") return -1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  const handleAddTask = async () => {
    if (!newTaskDesc.trim()) return;
    setAddingTask(true);
    try {
      await fetch(`/api/threads/${threadId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: newTaskDesc.trim(),
          assignee: newTaskAssignee || undefined,
        }),
      });
      setNewTaskDesc("");
      setNewTaskAssignee("");
      setShowAddTask(false);
      onRefreshTasks();
    } finally {
      setAddingTask(false);
    }
  };

  const handleToggleTask = async (task: any) => {
    const newStatus = task.status === "done" ? "open" : "done";
    await fetch(`/api/threads/${threadId}/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    onRefreshTasks();
  };

  const handleDeleteTask = async (taskId: string) => {
    await fetch(`/api/threads/${threadId}/tasks/${taskId}`, {
      method: "DELETE",
    });
    onRefreshTasks();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(selectedFiles)) {
        const content = await file.text();
        await fetch(`/api/threads/${threadId}/workspace/${encodeURIComponent(file.name)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
      }
      onRefreshFiles();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Description */}
      {description && (
        <>
          <div className="px-3 py-2">
            <p className="text-sm text-[var(--label-primary)] leading-relaxed">{description}</p>
          </div>
          <Divider />
        </>
      )}

      {/* ── Participants ── */}
      <div>
        <SectionHeader
          icon={Users}
          title="Participants"
          count={String(participants.length)}
          open={participantsOpen}
          onToggle={() => setParticipantsOpen(!participantsOpen)}
        />
        <Collapsible open={participantsOpen}>
          <div className="flex flex-col">
            {participants.map((p) => {
              const isAgent = p.type === "agent";
              const agent = isAgent ? agents.find((a: any) => a.id === p.id.replace("agent:", "")) : null;
              return (
                <div
                  key={p.id}
                  onClick={() => router.push(memberUrl(p.id))}
                  className="flex items-start gap-2 px-3 py-2 rounded-[8px] hover:bg-[var(--fill-quaternary)] transition-colors cursor-pointer"
                >
                  <MemberAvatar type={p.type} name={p.name} size={36} />
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-sm text-[var(--label-primary)]">{p.name}</span>
                    <div className="flex items-center gap-1 flex-wrap">
                      {isAgent ? (
                        <>
                          <span className="bg-[var(--color-orange-100)] text-[var(--color-orange-1000)] text-[10px] px-1.5 h-4 inline-flex items-center rounded-full">Agent</span>
                          {agent?.capabilities?.map((cap: string) => (
                            <span key={cap} className="bg-[var(--fill-quaternary)] text-[var(--label-secondary)] text-[10px] px-1.5 h-4 inline-flex items-center rounded-full">{cap}</span>
                          ))}
                        </>
                      ) : (
                        <span className="bg-[var(--color-green-100)] text-[var(--color-green-1000)] text-[10px] px-1.5 h-4 inline-flex items-center rounded-full">Human</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {/* Add Participant */}
            {isMember && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-[8px] cursor-pointer hover:bg-[var(--fill-quaternary)] transition-colors">
                <div className="size-9 shrink-0 rounded-full bg-[var(--fill-tertiary)] flex items-center justify-center">
                  <Plus className="size-5 text-[var(--label-primary)]" strokeWidth={1.5} />
                </div>
                <span className="text-sm text-[var(--label-primary)]">Add</span>
              </div>
            )}
          </div>
        </Collapsible>
      </div>

      <Divider />

      {/* ── Action Items ── */}
      <div>
        <SectionHeader
          icon={SquareCheckBig}
          title="Action Items"
          count={String(openTaskCount)}
          open={actionsOpen}
          onToggle={() => setActionsOpen(!actionsOpen)}
        />
        <Collapsible open={actionsOpen}>
          <div className="flex flex-col">
            {sortedTasks.length === 0 && !showAddTask && (
              <p className="px-3 py-2 text-sm text-[var(--label-tertiary)]">{t("sidebar.noTasks")}</p>
            )}
            {sortedTasks.map((task: any) => (
              <div key={task.id} className="flex items-start gap-2 px-3 py-2 rounded-[8px] group hover:bg-[var(--fill-quaternary)] transition-colors">
                <div className="pt-[2px] shrink-0">
                  {isMember ? (
                    <button
                      onClick={() => handleToggleTask(task)}
                      className="cursor-pointer"
                      title={task.status === "done" ? "Reopen" : "Mark done"}
                    >
                      {task.status === "done" ? (
                        <SquareCheck className="size-4 text-[var(--color-green-1000)]" strokeWidth={1.5} />
                      ) : (
                        <Square className="size-4 text-[var(--label-tertiary)] hover:text-[var(--label-primary)]" strokeWidth={1.5} />
                      )}
                    </button>
                  ) : (
                    task.status === "done" ? (
                      <SquareCheck className="size-4 text-[var(--color-green-1000)]" strokeWidth={1.5} />
                    ) : (
                      <Square className="size-4 text-[var(--label-tertiary)]" strokeWidth={1.5} />
                    )
                  )}
                </div>
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  <p className={`text-sm leading-snug ${task.status === "done" ? "line-through text-[var(--label-tertiary)]" : "text-[var(--label-primary)]"}`}>
                    {task.description}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-[var(--label-tertiary)]">
                    {task.assignee_name && <span>@{task.assignee_name}</span>}
                    {task.created_at && <span>{timeAgo(task.created_at)}</span>}
                  </div>
                </div>
                {isMember && (
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="shrink-0 pt-[2px] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    title="Delete task"
                  >
                    <Trash2 className="size-3.5 text-[var(--label-tertiary)] hover:text-[var(--color-red-1000)]" strokeWidth={1.5} />
                  </button>
                )}
              </div>
            ))}

            {/* Add task form */}
            {isMember && (showAddTask ? (
              <div className="mx-3 mt-1 mb-2 p-3 rounded-[8px] border border-[var(--border-color-secondary)] bg-[var(--bg-grouped-quaternary)] space-y-2">
                <input
                  type="text"
                  placeholder="Task description..."
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleAddTask();
                    }
                    if (e.key === "Escape") {
                      setShowAddTask(false);
                      setNewTaskDesc("");
                      setNewTaskAssignee("");
                    }
                  }}
                  className="w-full text-sm h-8 rounded-[6px] border border-[var(--border-color-secondary)] bg-[var(--bg-grouped-quinary)] px-2.5 text-[var(--label-primary)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--label-tertiary)]"
                  autoFocus
                />
                <select
                  value={newTaskAssignee}
                  onChange={(e) => setNewTaskAssignee(e.target.value)}
                  className="w-full text-sm h-8 rounded-[6px] border border-[var(--border-color-secondary)] bg-[var(--bg-grouped-quinary)] px-2 text-[var(--label-primary)]"
                >
                  <option value="">No assignee</option>
                  {participants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.type === "agent" ? `@${p.name}` : p.name}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddTask}
                    disabled={addingTask || !newTaskDesc.trim()}
                    className="text-xs px-3 h-7 rounded-[6px] bg-[var(--label-primary)] text-[var(--bg-grouped-primary)] font-medium disabled:opacity-40 cursor-pointer hover:opacity-90 transition-opacity"
                  >
                    {addingTask ? "..." : t("common.add")}
                  </button>
                  <button
                    onClick={() => { setShowAddTask(false); setNewTaskDesc(""); setNewTaskAssignee(""); }}
                    className="text-xs px-3 h-7 rounded-[6px] text-[var(--label-secondary)] hover:bg-[var(--fill-quaternary)] cursor-pointer transition-colors"
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddTask(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-[var(--label-tertiary)] hover:text-[var(--label-primary)] transition-colors cursor-pointer"
              >
                <Plus className="size-3.5" strokeWidth={1.5} />
                <span>{t("sidebar.addTask")}</span>
              </button>
            ))}
          </div>
        </Collapsible>
      </div>

      <Divider />

      {/* ── Files ── */}
      <div>
        <SectionHeader
          icon={Files}
          title="Files"
          count={files.length > 0 ? `${files.length} · ${formatSize(totalFileSize)}` : "0"}
          open={filesOpen}
          onToggle={() => setFilesOpen(!filesOpen)}
        />
        <Collapsible open={filesOpen}>
          <div className="flex flex-col">
            {files.length === 0 && (
              <p className="px-3 py-2 text-sm text-[var(--label-tertiary)]">{t("sidebar.noFiles")}</p>
            )}
            {files.map((file: any) => (
              <div key={file.name} className="flex items-center gap-2 px-3 py-2 rounded-[8px] hover:bg-[var(--fill-quaternary)] transition-colors cursor-pointer">
                <Pictogram name={getFilePictogram(file.name)} size={24} />
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-sm text-[var(--label-primary)] truncate">{file.name}</span>
                  <span className="text-xs text-[var(--label-tertiary)]">{formatSize(file.size || 0)}</span>
                </div>
              </div>
            ))}

            {/* Upload file */}
            {isMember && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".html,.htm,.md,.mdx,.markdown,.txt,.json,.css,.js,.ts,.tsx,.jsx,.yaml,.yml,.xml,.csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-[var(--label-tertiary)] hover:text-[var(--label-primary)] transition-colors cursor-pointer disabled:opacity-40"
                >
                  {uploading ? (
                    <Loader2 className="size-3.5 animate-spin" strokeWidth={1.5} />
                  ) : (
                    <Upload className="size-3.5" strokeWidth={1.5} />
                  )}
                  <span>{uploading ? "Uploading..." : t("sidebar.uploadFile")}</span>
                </button>
              </>
            )}
          </div>
        </Collapsible>
      </div>

      <Divider />

      {/* ── Links ── */}
      <div>
        <SectionHeader
          icon={Link2}
          title="Links"
          count={String(links.length)}
          open={linksOpen}
          onToggle={() => setLinksOpen(!linksOpen)}
        />
        <Collapsible open={linksOpen}>
          <div className="flex flex-col">
            {links.map((link: any) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 h-9 px-3 rounded-[8px] hover:bg-[var(--fill-quaternary)] transition-colors cursor-pointer"
              >
                <span className="text-sm text-[var(--label-primary)] truncate flex-1">{link.title || link.url}</span>
                <ArrowUpRight className="size-4 shrink-0 text-[var(--label-tertiary)]" strokeWidth={1.5} />
              </a>
            ))}
          </div>
        </Collapsible>
      </div>

      <Divider />

      {/* ── Git History ── */}
      <div>
        <SectionHeader
          icon={GitCommitHorizontal}
          title="Git History"
          open={gitOpen}
          onToggle={() => setGitOpen(!gitOpen)}
        />
        <Collapsible open={gitOpen}>
          <GitHistoryInline threadId={threadId} />
        </Collapsible>
      </div>
    </div>
  );
}

/** Inline git history — matches design with timeline dots */
function GitHistoryInline({ threadId }: { threadId: string }) {
  const [commits, setCommits] = useState<any[]>([]);

  useEffect(() => {
    fetch(`/api/threads/${threadId}/git-log`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.log) setCommits(data.log.slice(0, 10)); })
      .catch(() => {});
  }, [threadId]);

  if (commits.length === 0) return null;

  return (
    <div className="flex flex-col">
      {commits.map((commit: any, i: number) => (
        <div key={commit.hash || i} className="flex items-start gap-2 px-3">
          {/* Timeline */}
          <div className="flex flex-col items-center w-[15px] shrink-0 self-stretch">
            {i > 0 && <div className="w-px flex-1 bg-[#d9d9d9]" />}
            {i === 0 && <div className="w-px h-4" />}
            <div className="size-[7px] rounded-full bg-[#d9d9d9] shrink-0" />
            {i < commits.length - 1 && <div className="w-px flex-1 bg-[#d9d9d9]" />}
          </div>
          {/* Content */}
          <div className="flex flex-col gap-1 py-2 min-w-0">
            <p className="text-sm text-[var(--label-primary)] leading-snug">{commit.message}</p>
            <div className="flex items-center gap-1 text-xs text-[var(--label-tertiary)] flex-wrap">
              <span>{commit.short_hash || commit.hash?.slice(0, 7)}</span>
              <span>·</span>
              <span>{commit.author}</span>
              <span>·</span>
              <span>{commit.date ? timeAgo(commit.date) : ""}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
