"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ActivityFeed } from "@/components/thread/ActivityFeed";
import { ChatInput } from "@/components/ui/chat-input";
import { ThreadSidebar } from "@/components/thread/ThreadSidebar";
import { MarkdownBody } from "@/components/thread/MarkdownBody";
import { JoinButton, LeaveButton } from "@/components/thread/JoinButton";
import { EllipsisVertical, RotateCcw, X, MessageCircleX } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StatusBanner } from "@/components/thread/StatusBanner";
import { getChannelBadgeColor } from "@/components/layout/Sidebar";
import { useT } from "@/lib/i18n";

interface Participant {
  id: string;
  type: "human" | "agent";
  name: string;
}

interface ThreadMeta {
  id: string;
  title: string;
  description?: string;
  status: string;
  status_label?: string;
  status_detail?: string;
  labels?: string[];
  participants: Participant[];
  channel_id?: string;
  created_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  ts: number;
  from: string;
  from_name: string;
  type: "text" | "artifact" | "system" | "activity";
  body: string;
  artifact_version?: number;
  reply_to?: string;
}

interface WorkspaceFile {
  name: string;
  size: number;
  modified: string;
}

interface HyperlinkEntry {
  id: string;
  url: string;
  title: string;
  type: string;
  added_by: string;
  added_at: string;
}

interface ActionItemData {
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

interface RegisteredAgent {
  id: string;
  name: string;
  last_seen_at: string;
  capabilities?: string[];
}

interface UserInfo {
  id: string;
  name: string;
  email: string;
}

interface CurrentUser {
  id: string;
  name: string;
  email: string;
}


export default function ThreadDetailPage({ threadId: threadIdProp, showChannelBadge = true }: { threadId?: string; showChannelBadge?: boolean } = {}) {
  const params = useParams<{ threadId: string }>();
  const threadId = threadIdProp || params.threadId;
  const router = useRouter();
  const t = useT();

  const [thread, setThread] = useState<ThreadMeta | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [links, setLinks] = useState<HyperlinkEntry[]>([]);
  const [tasks, setTasks] = useState<ActionItemData[]>([]);
  const [channelName, setChannelName] = useState<string | null>(null);
  const [agents, setAgents] = useState<RegisteredAgent[]>([]);
  const [allUsers, setAllUsers] = useState<UserInfo[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const fetchThread = useCallback(async () => {
    const res = await fetch(`/api/threads/${threadId}`);
    if (!res.ok) {
      router.push("/");
      return;
    }
    const data = await res.json();
    setThread(data.thread);
    // Fetch channel name
    if (data.thread?.channel_id) {
      fetch(`/api/channels/${data.thread.channel_id}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setChannelName((d.channel ?? d).name); })
        .catch(() => {});
    } else {
      setChannelName(null);
    }
  }, [threadId, router]);

  const fetchMessages = useCallback(async () => {
    const res = await fetch(`/api/threads/${threadId}/messages`);
    if (res.ok) {
      const data = await res.json();
      setMessages((prev) => {
        if (data.messages.length !== prev.length) return data.messages;
        return prev;
      });
    }
  }, [threadId]);

  const fetchFiles = useCallback(async () => {
    const res = await fetch(`/api/threads/${threadId}/workspace`);
    if (res.ok) {
      const data = await res.json();
      setFiles(data.files ?? []);
    }
  }, [threadId]);

  const fetchLinks = useCallback(async () => {
    const res = await fetch(`/api/threads/${threadId}/links`);
    if (res.ok) {
      const data = await res.json();
      setLinks(data.links ?? []);
    }
  }, [threadId]);

  const fetchTasks = useCallback(async () => {
    const res = await fetch(`/api/threads/${threadId}/tasks`);
    if (res.ok) {
      const data = await res.json();
      setTasks(data.tasks ?? []);
    }
  }, [threadId]);

  const fetchAgents = useCallback(async () => {
    const res = await fetch("/api/agents");
    if (res.ok) {
      const data = await res.json();
      setAgents(data.agents ?? []);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    const res = await fetch("/api/users");
    if (res.ok) {
      const data = await res.json();
      setAllUsers(data.users ?? []);
    }
  }, []);

  const fetchCurrentUser = useCallback(async () => {
    const res = await fetch("/api/auth/me");
    if (res.ok) {
      const data = await res.json();
      setCurrentUser(data.user);
    }
  }, []);

  useEffect(() => {
    fetchThread();
    fetchMessages();
    fetchFiles();
    fetchLinks();
    fetchTasks();
    fetchAgents();
    fetchUsers();
    fetchCurrentUser();

    pollRef.current = setInterval(() => {
      fetchMessages();
      fetchFiles();
      fetchThread();
      fetchTasks();
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchThread, fetchMessages, fetchFiles, fetchLinks, fetchTasks, fetchAgents, fetchUsers, fetchCurrentUser]);

  // Reply state
  const [replyTo, setReplyTo] = useState<{ id: string; from_name: string; body: string } | null>(null);

  const handleReply = (messageId: string) => {
    const msg = messages.find(m => m.id === messageId);
    if (msg) {
      setReplyTo({ id: msg.id, from_name: msg.from_name, body: msg.body });
    }
  };

  const handleSendMessage = async (body: string, replyToId?: string) => {
    await fetch(`/api/threads/${threadId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, reply_to: replyToId }),
    });
    setReplyTo(null);
    // Don't block on refetch — input clears immediately after POST succeeds
    fetchMessages();
  };

  const handleStatusChange = async (newStatus: string) => {
    await fetch(`/api/threads/${threadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    await fetchThread();
  };

  const handleJoined = () => {
    fetchThread();
    fetchMessages();
  };

  const handleLeft = async () => {
    await fetch(`/api/threads/${threadId}/join`, { method: "DELETE" });
    fetchThread();
    fetchMessages();
  };


  if (!thread) {
    return null;
  }

  const isMember = currentUser
    ? thread.participants.some(p => p.id === `human:${currentUser.id}`)
    : false;

  return (
    <div className="h-screen flex items-stretch p-0">
      {/* Thread card — left rounded + left border only (top/right/bottom flush to edge) */}
      <div className="flex-1 flex overflow-hidden rounded-l-[var(--radius-medium-val)] border-l border-y-0 border-r-0 border-[var(--border-color-primary)] shadow-[0_0_64px_var(--grays-black-100,rgba(0,0,0,0.1))]">
        {/* Left: Chat area */}
        <div className="flex-1 flex flex-col min-w-0 bg-[var(--bg-grouped-quinary)] relative">
          {/* Thread title + status banner — fixed glass top */}
          <div className="flex flex-col gap-2 pt-6 px-6 pb-0 shrink-0 relative z-10 backdrop-blur-[20px]" style={{ backgroundColor: "color-mix(in srgb, var(--bg-grouped-quinary) 85%, transparent)" }}>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-[var(--label-primary)]">{thread.title}</h1>
              {showChannelBadge && channelName && thread.channel_id && (() => {
                const badgeColor = getChannelBadgeColor(thread.channel_id);
                return (
                  <span className={`text-xs px-2 h-5 inline-flex items-center rounded-full shrink-0 ${badgeColor.bg} ${badgeColor.text}`}>
                    {channelName}
                  </span>
                );
              })()}
              <div className="flex items-center gap-2 ml-auto shrink-0">
                {isMember && (
                  <DropdownMenu>
                    <DropdownMenuTrigger className="flex items-center justify-center size-8 rounded-[6px] text-[var(--label-primary)] hover:bg-[var(--fill-quaternary)] transition-all focus:outline-none cursor-pointer">
                      <EllipsisVertical className="size-5" strokeWidth={1.5} />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" sideOffset={4} className="w-[180px]">
                      {thread.status !== "done" && (
                        <DropdownMenuItem onSelect={() => setConfirmClose(true)}>
                          <X className="h-4 w-4" strokeWidth={1.5} /> {t("thread.closeThread")}
                        </DropdownMenuItem>
                      )}
                      {thread.status === "done" && (
                        <DropdownMenuItem onSelect={() => handleStatusChange("open")}>
                          <RotateCcw className="h-4 w-4" strokeWidth={1.5} /> {t("common.reopen")}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onSelect={() => handleLeft()} className="text-destructive focus:text-destructive focus:bg-[var(--color-red-100)]">
                        <MessageCircleX className="h-4 w-4" strokeWidth={1.5} /> {t("common.leaveThread")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <ConfirmDialog
                  open={confirmClose}
                  onOpenChange={setConfirmClose}
                  title={t("thread.closeThread")}
                  description={t("thread.confirmClose")}
                  confirmLabel={t("thread.closeThread")}
                  variant="default"
                  onConfirm={async () => { await handleStatusChange("done"); setConfirmClose(false); }}
                />
              </div>
            </div>
            <StatusBanner
              status={thread.status}
              statusLabel={thread.status_label}
              statusDetail={thread.status_detail}
              description={thread.description}
            />
          </div>

          {/* Messages */}
          <ActivityFeed threadId={threadId} messages={messages} onReply={isMember ? handleReply : undefined} currentUserId={currentUser?.id} />

          {/* Input or Join — fixed glass bottom */}
          <div className="px-6 pb-6 pt-0 shrink-0 relative z-10 backdrop-blur-[20px]" style={{ backgroundColor: "color-mix(in srgb, var(--bg-grouped-quinary) 85%, transparent)" }}>
            {isMember ? (
              <ChatInputWrapper onSend={(body) => handleSendMessage(body, replyTo?.id)} />
            ) : (
              <JoinBar threadId={threadId} onJoined={handleJoined} />
            )}
          </div>
        </div>

        {/* Right: Detail sidebar */}
        <div className="hidden md:flex w-[340px] shrink-0 flex-col overflow-y-auto border-l border-[var(--border-color-secondary)] bg-[var(--bg-grouped-quinary)] px-2 py-5 scrollbar-thin">
          <ThreadSidebar
            threadId={threadId}
            description={thread.description}
            participants={thread.participants}
            tasks={tasks}
            files={files}
            links={links}
            agents={agents}
            users={allUsers}
            isMember={isMember}
            onRefreshThread={fetchThread}
            onRefreshTasks={fetchTasks}
            onRefreshFiles={fetchFiles}
            onRefreshLinks={fetchLinks}
          />
        </div>
      </div>
    </div>
  );
}

/** Thin wrapper around ChatInput to manage local value state */
function ChatInputWrapper({ onSend }: { onSend: (body: string) => void }) {
  const [value, setValue] = useState("");
  const t = useT();
  return (
    <ChatInput
      value={value}
      onChange={setValue}
      placeholder={t("thread.writeComment")}
      onSend={() => {
        if (value.trim()) {
          onSend(value.trim());
          setValue("");
        }
      }}
      size="sm"
    />
  );
}

/** Join bar — same container style as ChatInput, with text + join button */
function JoinBar({ threadId, onJoined }: { threadId: string; onJoined: () => void }) {
  const [joining, setJoining] = useState(false);
  const t = useT();

  const handleJoin = async () => {
    setJoining(true);
    const res = await fetch(`/api/threads/${threadId}/join`, { method: "POST" });
    if (res.ok) onJoined();
    setJoining(false);
  };

  return (
    <div className="border border-input bg-[var(--bg-grouped-quaternary)] rounded-[12px] shadow-[0px_4px_24px_var(--grays-black-50,rgba(0,0,0,0.05))] flex items-center justify-between px-4 py-3">
      <span className="text-sm text-[var(--label-tertiary)]">{t("thread.joinToParticipate")}</span>
      <Button size="sm" onClick={handleJoin} disabled={joining}>
        {joining ? t("common.joining") : t("common.join")}
      </Button>
    </div>
  );
}
