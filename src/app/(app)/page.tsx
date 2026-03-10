"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/layout/AuthProvider";
import { ThreadList } from "@/components/shared/ThreadList";
import { NewThreadDialog } from "@/components/shared/NewThreadDialog";
import { useT } from "@/lib/i18n";
import type { ThreadMeta, RegisteredAgent, ChannelMeta, User } from "@/components/shared/types";

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const t = useT();
  const [threads, setThreads] = useState<ThreadMeta[]>([]);
  const [agents, setAgents] = useState<RegisteredAgent[]>([]);
  const [channels, setChannels] = useState<ChannelMeta[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

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

  const fetchThreads = async () => {
    const res = await fetch("/api/threads");
    if (res.ok) setThreads((await res.json()).threads ?? []);
  };

  const handleDelete = async (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(t("home.confirmDeleteThread"))) return;
    const res = await fetch(`/api/threads/${threadId}`, { method: "DELETE" });
    if (res.ok) setThreads((prev) => prev.filter((t) => t.id !== threadId));
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-muted-foreground text-sm">{t("common.loading")}</div>
      </div>
    );
  }

  // For You — threads where current user is a participant
  const myUserId = user ? `human:${user.id}` : "";
  const myThreads = threads
    .filter((t) => t.participants.some((p) => p.id === myUserId))
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  // All threads sorted by updated_at
  const allThreadsSorted = [...threads].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-10">
      {/* For You */}
      {myThreads.length > 0 && (
        <div className="mb-10">
          <h2 className="text-xl font-semibold tracking-tight mb-4">{t("home.forYou")}</h2>
          <ThreadList threads={myThreads} onDelete={handleDelete} channels={channels} />
        </div>
      )}

      {/* All Threads */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold tracking-tight">{t("home.threads")}</h2>
        <NewThreadDialog agents={agents} users={allUsers} channels={channels} onCreated={fetchThreads} />
      </div>

      {allThreadsSorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border py-16 text-center px-4">
          <p className="text-muted-foreground text-sm">
            {t("home.noThreads")}
          </p>
        </div>
      ) : (
        <ThreadList threads={allThreadsSorted} onDelete={handleDelete} channels={channels} />
      )}
    </main>
  );
}
