"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/layout/AuthProvider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ThreadList } from "@/components/shared/ThreadList";
import { NewThreadDialog } from "@/components/shared/NewThreadDialog";
import { CreateChannelForm } from "@/components/shared/CreateChannelForm";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { timeAgo } from "@/components/shared/helpers";
import { MemberAvatar } from "@/components/shared/MemberAvatar";
import { useT } from "@/lib/i18n";
import type { ThreadMeta, RegisteredAgent, ChannelMeta, User, Participant } from "@/components/shared/types";

export default function ChannelsPage() {
  const { user, loading: authLoading } = useAuth();
  const t = useT();
  const [threads, setThreads] = useState<ThreadMeta[]>([]);
  const [agents, setAgents] = useState<RegisteredAgent[]>([]);
  const [channels, setChannels] = useState<ChannelMeta[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set());
  const [addingMemberTo, setAddingMemberTo] = useState<string | null>(null);
  const [memberAdding, setMemberAdding] = useState(false);
  const [confirmDeleteChannelId, setConfirmDeleteChannelId] = useState<string | null>(null);
  const [confirmDeleteThreadId, setConfirmDeleteThreadId] = useState<string | null>(null);
  const [confirmLeaveChannelId, setConfirmLeaveChannelId] = useState<string | null>(null);
  const [leavingChannel, setLeavingChannel] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    async function load() {
      const [threadsRes, agentsRes, channelsRes, usersRes] = await Promise.all([
        fetch("/api/threads"),
        fetch("/api/agents"),
        fetch("/api/channels"),
        fetch("/api/users"),
      ]);
      if (threadsRes.ok) setThreads((await threadsRes.json()).threads ?? []);
      if (agentsRes.ok) setAgents((await agentsRes.json()).agents ?? []);
      if (channelsRes.ok) setChannels((await channelsRes.json()).channels ?? []);
      if (usersRes.ok) setAllUsers((await usersRes.json()).users ?? []);
      setLoading(false);
    }
    load();
  }, [authLoading]);

  const fetchChannels = async () => {
    const res = await fetch("/api/channels");
    if (res.ok) setChannels((await res.json()).channels ?? []);
  };

  const fetchThreads = async () => {
    const res = await fetch("/api/threads");
    if (res.ok) setThreads((await res.json()).threads ?? []);
  };

  const handleAddMember = async (channelId: string, member: Participant) => {
    setMemberAdding(true);
    try {
      const res = await fetch(`/api/channels/${channelId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(member),
      });
      if (res.ok) {
        setAddingMemberTo(null);
        await fetchChannels();
      }
    } finally {
      setMemberAdding(false);
    }
  };

  const handleLeaveChannel = async (channelId: string) => {
    setLeavingChannel(true);
    try {
      const res = await fetch(`/api/channels/${channelId}/members`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchChannels();
      }
    } finally {
      setLeavingChannel(false);
      setConfirmLeaveChannelId(null);
    }
  };

  const handleDeleteChannel = async (channelId: string) => {
    const res = await fetch(`/api/channels/${channelId}`, { method: "DELETE" });
    if (res.ok) {
      setChannels((prev) => prev.filter((p) => p.id !== channelId));
      await fetchThreads();
    }
  };

  const handleDeleteThread = async (threadId: string) => {
    const res = await fetch(`/api/threads/${threadId}`, { method: "DELETE" });
    if (res.ok) setThreads((prev) => prev.filter((t) => t.id !== threadId));
  };

  const toggleChannel = (channelId: string) => {
    setExpandedChannels((prev) => {
      const next = new Set(prev);
      if (next.has(channelId)) next.delete(channelId);
      else next.add(channelId);
      return next;
    });
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-muted-foreground text-sm">{t("common.loading")}</div>
      </div>
    );
  }

  const sortedChannels = [...channels].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold tracking-tight">{t("channels.title")}</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              {t("channels.newChannel")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("channels.createChannel")}</DialogTitle>
            </DialogHeader>
            <CreateChannelForm
              agents={agents}
              users={allUsers}
              currentUserId={user?.id}
              onSuccess={() => {
                setCreateOpen(false);
                fetchChannels();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {sortedChannels.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border py-16 text-center">
          <p className="text-muted-foreground text-sm">
            {t("channels.noChannels")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedChannels.map((channel) => {
            const channelThreads = threads.filter((t) => t.channel_id === channel.id);
            const isExpanded = expandedChannels.has(channel.id);
            return (
              <div key={channel.id} className="rounded-md border border-border bg-[var(--bg-grouped-quaternary)]">
                <div
                  className="group flex items-center justify-between w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => toggleChannel(channel.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{isExpanded ? "\u25B4" : "\u25BE"}</span>
                    <div>
                      <span className="text-sm font-medium">{channel.name}</span>
                      {channel.description && (
                        <span className="ml-2 text-xs text-muted-foreground">{channel.description}</span>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          {t("channels.memberCount").replace("{count}", String(channel.members.length))} &middot; {t("channels.threadCount").replace("{count}", String(channelThreads.length))}
                        </span>
                        <span className="text-xs text-muted-foreground">&middot;</span>
                        <span className="text-xs text-muted-foreground">{timeAgo(channel.updated_at)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {user && channel.members.some((m) => m.id === `human:${user.id}`) && (
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-xs text-muted-foreground hover:text-destructive"
                        title={t("common.leaveChannel")}
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmLeaveChannelId(channel.id);
                        }}
                      >
                        {t("common.leave")}
                      </button>
                    )}
                    <button
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-muted-foreground hover:text-destructive"
                      title={t("common.delete")}
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteChannelId(channel.id);
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border">
                    {/* Members section */}
                    <div className="px-4 py-3 border-b border-border">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground font-medium">{t("channels.membersLabel")}</span>
                        {channel.members.map((m) => (
                          <MemberAvatar key={m.id} type={m.type} name={m.name} size={20} avatarUrl={m.type === "human" ? allUsers.find(u => `human:${u.id}` === m.id)?.avatar_url : undefined} />
                        ))}
                        {addingMemberTo !== channel.id && (
                          <button
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => setAddingMemberTo(channel.id)}
                          >
                            <span className="text-sm">+</span> {t("common.add")}
                          </button>
                        )}
                      </div>
                      {addingMemberTo === channel.id && (() => {
                        const memberIds = new Set(channel.members.map((m) => m.id));
                        const availUsers = allUsers.filter((u) => !memberIds.has(`human:${u.id}`));
                        const availAgents = agents.filter((a) => !memberIds.has(`agent:${a.id}`));
                        return (availUsers.length > 0 || availAgents.length > 0) ? (
                          <div className="rounded-md border border-border divide-y divide-border mt-2 max-h-40 overflow-y-auto bg-[var(--bg-grouped-quaternary)]">
                            {availUsers.map((u) => (
                              <button
                                key={u.id}
                                type="button"
                                disabled={memberAdding}
                                onClick={() => handleAddMember(channel.id, { id: `human:${u.id}`, type: "human", name: u.name })}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted/50 disabled:opacity-50"
                              >
                                <MemberAvatar type="human" name={u.name} size={20} avatarUrl={u.avatar_url} />
                                <span>{u.name}</span>
                              </button>
                            ))}
                            {availAgents.map((agent) => (
                              <button
                                key={agent.id}
                                type="button"
                                disabled={memberAdding}
                                onClick={() => handleAddMember(channel.id, { id: `agent:${agent.id}`, type: "agent", name: agent.name })}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted/50 disabled:opacity-50"
                              >
                                <MemberAvatar type="agent" name={agent.name} size={20} />
                                <span>@{agent.name}</span>
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => setAddingMemberTo(null)}
                              className="flex w-full items-center justify-center px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {t("common.cancel")}
                            </button>
                          </div>
                        ) : (
                          <div className="mt-2 text-xs text-muted-foreground">
                            {t("channels.noMoreMembers")}{" "}
                            <button onClick={() => setAddingMemberTo(null)} className="hover:text-foreground">{t("common.dismiss")}</button>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Threads + New Thread button */}
                    <div className="px-4 py-2 flex items-center justify-end">
                      <NewThreadDialog
                        agents={agents}
                        users={allUsers}
                        channels={channels}
                        defaultChannelId={channel.id}
                        onCreated={fetchThreads}
                      />
                    </div>
                    {channelThreads.length === 0 ? (
                      <div className="px-4 pb-4 text-center">
                        <p className="text-xs text-muted-foreground">{t("channels.noThreads")}</p>
                      </div>
                    ) : (
                      <ThreadList threads={channelThreads} onDelete={(threadId, e) => { e.stopPropagation(); setConfirmDeleteThreadId(threadId); }} userAvatars={new Map(allUsers.map(u => [u.id, u.avatar_url ?? null]))} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <ConfirmDialog
        open={!!confirmLeaveChannelId}
        onOpenChange={(open) => { if (!open) setConfirmLeaveChannelId(null); }}
        title={t("channels.confirmLeave")}
        variant="destructive"
        onConfirm={async () => {
          if (confirmLeaveChannelId) {
            await handleLeaveChannel(confirmLeaveChannelId);
          }
        }}
      />
      <ConfirmDialog
        open={!!confirmDeleteChannelId}
        onOpenChange={(open) => { if (!open) setConfirmDeleteChannelId(null); }}
        title={t("channels.confirmDelete")}
        variant="destructive"
        onConfirm={async () => {
          if (confirmDeleteChannelId) {
            await handleDeleteChannel(confirmDeleteChannelId);
          }
          setConfirmDeleteChannelId(null);
        }}
      />
      <ConfirmDialog
        open={!!confirmDeleteThreadId}
        onOpenChange={(open) => { if (!open) setConfirmDeleteThreadId(null); }}
        title={t("home.confirmDeleteThread")}
        variant="destructive"
        onConfirm={async () => {
          if (confirmDeleteThreadId) {
            await handleDeleteThread(confirmDeleteThreadId);
          }
          setConfirmDeleteThreadId(null);
        }}
      />
    </main>
  );
}
