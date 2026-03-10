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
import { timeAgo } from "@/components/shared/helpers";
import { MemberAvatar } from "@/components/shared/MemberAvatar";
import type { ThreadMeta, RegisteredAgent, ChannelMeta, User, Participant } from "@/components/shared/types";

export default function ChannelsPage() {
  const { user, loading: authLoading } = useAuth();
  const [threads, setThreads] = useState<ThreadMeta[]>([]);
  const [agents, setAgents] = useState<RegisteredAgent[]>([]);
  const [channels, setChannels] = useState<ChannelMeta[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set());
  const [addingMemberTo, setAddingMemberTo] = useState<string | null>(null);
  const [memberAdding, setMemberAdding] = useState(false);

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

  const handleDeleteChannel = async (channelId: string) => {
    if (!confirm("Delete this channel? Threads in this channel will become unassigned.")) return;
    const res = await fetch(`/api/channels/${channelId}`, { method: "DELETE" });
    if (res.ok) {
      setChannels((prev) => prev.filter((p) => p.id !== channelId));
      await fetchThreads();
    }
  };

  const handleDeleteThread = async (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this thread?")) return;
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
        <div className="animate-pulse text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  const sortedChannels = [...channels].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Channels</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button variant="outline" size="sm" />}>
            + New Channel
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Channel</DialogTitle>
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
            Create channels to organize threads and members.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedChannels.map((channel) => {
            const channelThreads = threads.filter((t) => t.channel_id === channel.id);
            const isExpanded = expandedChannels.has(channel.id);
            return (
              <div key={channel.id} className="rounded-md border border-border">
                <button
                  className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors"
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
                          {channel.members.length} members &middot; {channelThreads.length} threads
                        </span>
                        <span className="text-xs text-muted-foreground">&middot;</span>
                        <span className="text-xs text-muted-foreground">{timeAgo(channel.updated_at)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="text-xs text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteChannel(channel.id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border">
                    {/* Members section */}
                    <div className="px-4 py-3 border-b border-border">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground font-medium">Members:</span>
                        {channel.members.map((m) => (
                          <MemberAvatar key={m.id} type={m.type} name={m.name} size={20} />
                        ))}
                        {addingMemberTo !== channel.id && (
                          <button
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => setAddingMemberTo(channel.id)}
                          >
                            <span className="text-sm">+</span> Add
                          </button>
                        )}
                      </div>
                      {addingMemberTo === channel.id && (() => {
                        const memberIds = new Set(channel.members.map((m) => m.id));
                        const availUsers = allUsers.filter((u) => !memberIds.has(`human:${u.id}`));
                        const availAgents = agents.filter((a) => !memberIds.has(`agent:${a.id}`));
                        return (availUsers.length > 0 || availAgents.length > 0) ? (
                          <div className="rounded-md border border-border divide-y divide-border mt-2 max-h-40 overflow-y-auto">
                            {availUsers.map((u) => (
                              <button
                                key={u.id}
                                type="button"
                                disabled={memberAdding}
                                onClick={() => handleAddMember(channel.id, { id: `human:${u.id}`, type: "human", name: u.name })}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted/50 disabled:opacity-50"
                              >
                                <MemberAvatar type="human" name={u.name} size={20} />
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
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="mt-2 text-xs text-muted-foreground">
                            No more members to add.{" "}
                            <button onClick={() => setAddingMemberTo(null)} className="hover:text-foreground">Dismiss</button>
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
                        <p className="text-xs text-muted-foreground">No threads in this channel yet.</p>
                      </div>
                    ) : (
                      <ThreadList threads={channelThreads} onDelete={handleDeleteThread} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
