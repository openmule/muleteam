"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ActivityFeed } from "@/components/thread/ActivityFeed";
import { CommentInput } from "@/components/thread/CommentInput";
import { WorkspaceFiles } from "@/components/thread/WorkspaceFiles";
import { WorkspaceLinks } from "@/components/thread/WorkspaceLinks";
import { ParticipantsList } from "@/components/thread/ParticipantsList";
import { ActionItems } from "@/components/thread/ActionItems";
import { GitHistory } from "@/components/thread/GitHistory";
import { MarkdownBody } from "@/components/thread/MarkdownBody";
import { JoinButton, LeaveButton } from "@/components/thread/JoinButton";
import { MobileDetailSheet } from "@/components/thread/MobileDetailSheet";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PageViewer, RENDERABLE_RE, type CreateAnnotationPayload } from "@/components/thread/PageViewer";
import { ResizablePanel } from "@/components/ui/resizable-panel";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  labels?: string[];
  participants: Participant[];
  created_at: string;
  updated_at: string;
}

interface AnnotationAnchor {
  file_path: string;
  anchor_type: "line" | "selector";
  start_line?: number;
  end_line?: number;
  selector?: string;
  commit_hash: string;
  content_snapshot: string;
}

interface Message {
  id: string;
  ts: number;
  from: string;
  from_name: string;
  type: "text" | "artifact" | "system" | "activity" | "annotation";
  body: string;
  artifact_version?: number;
  reply_to?: string;
  annotation?: AnnotationAnchor;
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

const STATUS_ICON: Record<string, string> = {
  open: "\u25CB",
  in_progress: "\u25CF",
  done: "\u2713",
  archived: "\u2014",
};

export default function ThreadDetailPage() {
  const { threadId } = useParams<{ threadId: string }>();
  const router = useRouter();
  const t = useT();

  const [thread, setThread] = useState<ThreadMeta | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [links, setLinks] = useState<HyperlinkEntry[]>([]);
  const [tasks, setTasks] = useState<ActionItemData[]>([]);
  const [agents, setAgents] = useState<RegisteredAgent[]>([]);
  const [allUsers, setAllUsers] = useState<UserInfo[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [sidebarTab, setSidebarTab] = useState(0);
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
    const saved = sessionStorage.getItem("muleteam:sidebar-tab");
    if (saved) setSidebarTab(Number(saved));
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

  // Annotation navigation state: which annotation to highlight in page viewer
  const [highlightAnnotationId, setHighlightAnnotationId] = useState<string | null>(null);

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
    fetchMessages();
  };

  // Thread → Page: click annotation message → highlight in page viewer
  const handleNavigateToAnnotation = useCallback((messageId: string) => {
    setHighlightAnnotationId(messageId);
    // Clear after animation
    setTimeout(() => setHighlightAnnotationId(null), 3000);
  }, []);

  // Page → Thread: create annotation from page viewer
  const handleCreateAnnotation = useCallback(async (payload: CreateAnnotationPayload, body: string) => {
    await fetch(`/api/threads/${threadId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, annotation: payload }),
    });
    fetchMessages();
  }, [threadId, fetchMessages]);

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

  const handleLeft = () => {
    fetchThread();
    fetchMessages();
  };

  const handleSidebarTabChange = (value: unknown) => {
    const idx = typeof value === "number" ? value : 0;
    setSidebarTab(idx);
    sessionStorage.setItem("muleteam:sidebar-tab", String(idx));
  };

  const openTaskCount = tasks.filter(t => t.status !== "done").length;

  if (!thread) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground text-sm">{t("common.loading")}</div>
      </div>
    );
  }

  const isMember = currentUser
    ? thread.participants.some(p => p.id === `human:${currentUser.id}`)
    : false;

  const hasRenderableFiles = files.some(f => RENDERABLE_RE.test(f.name));

  // Left panel: Chat + sidebar tabs
  const leftPanel = (
    <div className="flex flex-col flex-1 min-h-0">
      <Tabs value={sidebarTab} onValueChange={handleSidebarTabChange} className="min-h-0 flex flex-col flex-1">
        <TabsList variant="line" className="w-full justify-start px-3 pt-1 border-b border-border shrink-0">
          <TabsTrigger value={0} className="text-xs">
            {t("sidebar.chat")}
          </TabsTrigger>
          <TabsTrigger value={1} className="text-xs gap-1">
            {t("sidebar.actionItems")}
            {openTaskCount > 0 && (
              <span className="text-[10px] text-muted-foreground">({openTaskCount})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value={2} className="text-xs">
            {t("sidebar.participants")}
          </TabsTrigger>
          <TabsTrigger value={3} className="text-xs">
            {t("sidebar.files")}
          </TabsTrigger>
        </TabsList>

        {/* Chat tab */}
        <TabsContent value={0} className="flex flex-col flex-1 min-h-0">
          {thread.description && (
            <div className="px-4 sm:px-6 py-3 border-b border-border text-muted-foreground">
              <MarkdownBody body={thread.description} />
            </div>
          )}
          <ActivityFeed threadId={threadId} messages={messages} onReply={isMember ? handleReply : undefined} onNavigateToAnnotation={handleNavigateToAnnotation} />
          {isMember ? (
            <CommentInput
              threadId={threadId}
              onSubmit={handleSendMessage}
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
              participants={thread.participants}
            />
          ) : (
            <JoinButton threadId={threadId} onJoined={handleJoined} />
          )}
        </TabsContent>

        {/* Tasks tab */}
        <TabsContent value={1} className="flex-1 overflow-y-auto">
          <ActionItems
            threadId={threadId}
            tasks={tasks}
            participants={thread.participants}
            onRefresh={fetchTasks}
            readOnly={!isMember}
            embedded
          />
        </TabsContent>

        {/* Participants tab */}
        <TabsContent value={2} className="flex-1 overflow-y-auto">
          <ParticipantsList
            threadId={threadId}
            participants={thread.participants}
            agents={agents}
            users={allUsers}
            onParticipantAdded={fetchThread}
            readOnly={!isMember}
            embedded
          />
        </TabsContent>

        {/* Files tab */}
        <TabsContent value={3} className="flex-1 overflow-y-auto">
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
          <GitHistory threadId={threadId} />
        </TabsContent>
      </Tabs>
    </div>
  );

  // Right panel: Page viewer
  const rightPanel = (
    <PageViewer
      threadId={threadId}
      files={files}
      messages={messages}
      onCreateAnnotation={isMember ? handleCreateAnnotation : undefined}
      highlightAnnotationId={highlightAnnotationId}
      onPinClicked={handleNavigateToAnnotation}
    />
  );

  return (
    <div className="h-[calc(100dvh-3.5rem)] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/")}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            &larr; <span className="hidden sm:inline">{t("common.back")}</span>
          </Button>
          <div className="h-4 w-px bg-border hidden sm:block" />
          <h1 className="text-sm sm:text-base font-semibold truncate">{thread.title}</h1>
          <span className="text-sm text-muted-foreground font-mono shrink-0 hidden sm:inline" title={thread.status}>
            {STATUS_ICON[thread.status] || "\u25CB"} {thread.status.replace("_", " ")}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Mobile detail sheet trigger */}
          <MobileDetailSheet
            threadId={threadId}
            tasks={tasks}
            files={files}
            participants={thread.participants}
            agents={agents}
            users={allUsers}
            readOnly={!isMember}
            onRefreshTasks={fetchTasks}
            onRefreshFiles={fetchFiles}
            onParticipantAdded={fetchThread}
          />
          {isMember && thread.status !== "done" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmClose(true)}
                className="text-xs"
              >
                {t("common.close")}
              </Button>
              <ConfirmDialog
                open={confirmClose}
                onOpenChange={setConfirmClose}
                title={t("thread.closeThread")}
                description={t("thread.confirmClose")}
                confirmLabel={t("thread.closeThread")}
                variant="default"
                onConfirm={async () => {
                  await handleStatusChange("done");
                  setConfirmClose(false);
                }}
              />
            </>
          )}
          {isMember && thread.status === "done" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStatusChange("open")}
              className="text-xs"
            >
              {t("common.reopen")}
            </Button>
          )}
          {isMember && (
            <LeaveButton threadId={threadId} onLeft={handleLeft} />
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
        {/* Desktop: split layout with page viewer OR original layout */}
        <div className="hidden md:flex flex-1 min-h-0">
          {hasRenderableFiles ? (
            <ResizablePanel
              left={leftPanel}
              right={rightPanel}
              defaultRatio={0.4}
              storageKey={`muleteam:panel-ratio:${threadId}`}
            />
          ) : (
            /* Original layout: chat left + sidebar right */
            <>
              <div className="flex-1 md:w-3/5 flex flex-col md:border-r border-border min-h-0">
                {thread.description && (
                  <div className="px-4 sm:px-6 py-4 border-b border-border text-muted-foreground">
                    <MarkdownBody body={thread.description} />
                  </div>
                )}
                <ActivityFeed threadId={threadId} messages={messages} onReply={isMember ? handleReply : undefined} onNavigateToAnnotation={handleNavigateToAnnotation} />
                {isMember ? (
                  <CommentInput
                    threadId={threadId}
                    onSubmit={handleSendMessage}
                    replyTo={replyTo}
                    onCancelReply={() => setReplyTo(null)}
                    participants={thread.participants}
                  />
                ) : (
                  <JoinButton threadId={threadId} onJoined={handleJoined} />
                )}
              </div>
              <div className="md:w-2/5 flex flex-col overflow-hidden border-border">
                <Tabs value={sidebarTab} onValueChange={handleSidebarTabChange} className="min-h-0 flex flex-col flex-1">
                  <TabsList variant="line" className="w-full justify-start px-3 pt-2 border-b border-border shrink-0">
                    <TabsTrigger value={0} className="text-xs gap-1">
                      {t("sidebar.actionItems")}
                      {openTaskCount > 0 && (
                        <span className="text-[10px] text-muted-foreground">({openTaskCount})</span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value={1} className="text-xs">
                      {t("sidebar.participants")}
                    </TabsTrigger>
                  </TabsList>
                  <div className="flex-1 overflow-y-auto min-h-0">
                    <TabsContent value={0}>
                      <ActionItems threadId={threadId} tasks={tasks} participants={thread.participants} onRefresh={fetchTasks} readOnly={!isMember} embedded />
                    </TabsContent>
                    <TabsContent value={1}>
                      <ParticipantsList threadId={threadId} participants={thread.participants} agents={agents} users={allUsers} onParticipantAdded={fetchThread} readOnly={!isMember} embedded />
                    </TabsContent>
                  </div>
                </Tabs>
                <div className="border-t border-border overflow-y-auto min-h-[120px] max-h-[40%]">
                  <WorkspaceFiles threadId={threadId} files={files} onRefresh={fetchFiles} readOnly={!isMember} />
                  <WorkspaceLinks threadId={threadId} links={links} onRefresh={fetchLinks} readOnly={!isMember} />
                  <GitHistory threadId={threadId} />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Mobile: single column, chat only (pages via mobile sheet later) */}
        <div className="flex md:hidden flex-col flex-1 min-h-0">
          {thread.description && (
            <div className="px-4 py-3 border-b border-border text-muted-foreground">
              <MarkdownBody body={thread.description} />
            </div>
          )}
          <ActivityFeed threadId={threadId} messages={messages} onReply={isMember ? handleReply : undefined} onNavigateToAnnotation={handleNavigateToAnnotation} />
          {isMember ? (
            <CommentInput
              threadId={threadId}
              onSubmit={handleSendMessage}
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
              participants={thread.participants}
            />
          ) : (
            <JoinButton threadId={threadId} onJoined={handleJoined} />
          )}
        </div>
      </div>
    </div>
  );
}
