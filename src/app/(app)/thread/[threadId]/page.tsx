"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ActivityFeed } from "@/components/thread/ActivityFeed";
import { CommentInput } from "@/components/thread/CommentInput";
import { WorkspaceFiles } from "@/components/thread/WorkspaceFiles";
import { WorkspaceLinks } from "@/components/thread/WorkspaceLinks";
import { ParticipantsList } from "@/components/thread/ParticipantsList";
import { GitHistory } from "@/components/thread/GitHistory";
import { JoinButton } from "@/components/thread/JoinButton";

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
  labels?: string[];
  participants: Participant[];
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

interface RegisteredAgent {
  id: string;
  name: string;
  last_seen_at: string;
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

const STATUS_ICON: Record<string, string> = {
  open: "\u25CB",
  in_progress: "\u25CF",
  done: "\u2713",
  archived: "\u2014",
};

export default function ThreadDetailPage() {
  const { threadId } = useParams<{ threadId: string }>();
  const router = useRouter();

  const [thread, setThread] = useState<ThreadMeta | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [links, setLinks] = useState<HyperlinkEntry[]>([]);
  const [agents, setAgents] = useState<RegisteredAgent[]>([]);
  const [allUsers, setAllUsers] = useState<UserInfo[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const fetchThread = useCallback(async () => {
    const res = await fetch(`/api/threads/${threadId}`);
    if (!res.ok) {
      router.push("/");
      return;
    }
    const data = await res.json();
    setThread(data.thread);
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
    fetchAgents();
    fetchUsers();
    fetchCurrentUser();

    pollRef.current = setInterval(() => {
      fetchMessages();
      fetchFiles();
      fetchThread();
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchThread, fetchMessages, fetchFiles, fetchLinks, fetchAgents, fetchUsers, fetchCurrentUser]);

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
    await fetchMessages();
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

  if (!thread) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  const isMember = currentUser
    ? thread.participants.some(p => p.id === `human:${currentUser.id}`)
    : false;

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/")}
            className="text-muted-foreground hover:text-foreground"
          >
            &larr; Back
          </Button>
          <div className="h-4 w-px bg-border" />
          <h1 className="text-base font-semibold truncate">{thread.title}</h1>
          <span className="text-sm text-muted-foreground font-mono" title={thread.status}>
            {STATUS_ICON[thread.status] || "\u25CB"} {thread.status.replace("_", " ")}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isMember && thread.status !== "done" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStatusChange("done")}
              className="text-xs"
            >
              Close
            </Button>
          )}
          {isMember && thread.status === "done" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStatusChange("open")}
              className="text-xs"
            >
              Reopen
            </Button>
          )}
        </div>
      </header>

      {/* Main: Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Activity Feed (60%) */}
        <div className="w-3/5 flex flex-col border-r border-border min-h-0">
          {/* Description */}
          {thread.description && (
            <div className="px-6 py-4 border-b border-border">
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {thread.description}
              </p>
            </div>
          )}

          {/* Messages */}
          <ActivityFeed messages={messages} onReply={isMember ? handleReply : undefined} />

          {/* Comment input or Join button */}
          {isMember ? (
            <CommentInput
              onSubmit={handleSendMessage}
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
            />
          ) : (
            <JoinButton threadId={threadId} onJoined={handleJoined} />
          )}
        </div>

        {/* Right: Workspace (40%) */}
        <div className="w-2/5 flex flex-col overflow-y-auto">
          <WorkspaceFiles
            threadId={threadId}
            files={files}
            onRefresh={fetchFiles}
            readOnly={!isMember}
          />

          <WorkspaceLinks
            threadId={threadId}
            links={links}
            onRefresh={fetchLinks}
            readOnly={!isMember}
          />

          <ParticipantsList
            threadId={threadId}
            participants={thread.participants}
            agents={agents}
            users={allUsers}
            onParticipantAdded={fetchThread}
            readOnly={!isMember}
          />

          <GitHistory threadId={threadId} />
        </div>
      </div>
    </div>
  );
}
