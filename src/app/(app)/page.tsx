"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/layout/AuthProvider";
import { ThreadList } from "@/components/shared/ThreadList";
import { NewThreadDialog } from "@/components/shared/NewThreadDialog";
import { EventFeed } from "@/components/shared/EventFeed";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useT } from "@/lib/i18n";
import type { ThreadMeta, RegisteredAgent, ChannelMeta, User, NotificationEvent } from "@/components/shared/types";

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const t = useT();
  const [threads, setThreads] = useState<ThreadMeta[]>([]);
  const [agents, setAgents] = useState<RegisteredAgent[]>([]);
  const [channels, setChannels] = useState<ChannelMeta[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteThreadId, setConfirmDeleteThreadId] = useState<string | null>(null);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (authLoading) return;
    async function load() {
      const [threadsRes, agentsRes, channelsRes, usersRes, eventsRes, pinsRes] = await Promise.all([
        fetch("/api/threads"),
        fetch("/api/agents"),
        fetch("/api/channels"),
        fetch("/api/users"),
        fetch("/api/events?limit=30"),
        fetch("/api/threads/pins"),
      ]);
      if (threadsRes.ok) setThreads((await threadsRes.json()).threads ?? []);
      if (agentsRes.ok) setAgents((await agentsRes.json()).agents ?? []);
      if (channelsRes.ok) setChannels((await channelsRes.json()).channels ?? []);
      if (usersRes.ok) setAllUsers((await usersRes.json()).users ?? []);
      if (eventsRes.ok) setEvents((await eventsRes.json()).events ?? []);
      if (pinsRes.ok) {
        const pins = (await pinsRes.json()).pins ?? [];
        setPinnedIds(new Set(pins.map((p: { thread_id: string }) => p.thread_id)));
      }
      setLoading(false);
    }
    load();
  }, [authLoading]);

  const fetchThreads = async () => {
    const res = await fetch("/api/threads");
    if (res.ok) setThreads((await res.json()).threads ?? []);
  };

  const handleDelete = async (threadId: string) => {
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

  // All threads sorted: pinned first, then by updated_at
  const allThreadsSorted = [...threads].sort((a, b) => {
    const aPinned = pinnedIds.has(a.id);
    const bPinned = pinnedIds.has(b.id);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  const isOwner = user?.team_role === "owner";

  const handleTogglePin = async (threadId: string, currentlyPinned: boolean) => {
    const res = await fetch(`/api/threads/${threadId}/pin`, {
      method: currentlyPinned ? "DELETE" : "POST",
    });
    if (res.ok) {
      setPinnedIds((prev) => {
        const next = new Set(prev);
        if (currentlyPinned) next.delete(threadId);
        else next.add(threadId);
        return next;
      });
    }
  };

  const handleMarkRead = async (eventId: string) => {
    await fetch(`/api/events/${eventId}`, { method: "PATCH" });
    setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, read: true } : e)));
    window.dispatchEvent(new Event("muleteam:events-changed"));
  };

  const handleMarkAllRead = async () => {
    await fetch("/api/events/read-all", { method: "POST" });
    setEvents((prev) => prev.map((e) => ({ ...e, read: true })));
    window.dispatchEvent(new Event("muleteam:events-changed"));
  };

  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-10">
      {/* For You — notification events */}
      <div className="mb-10">
        <h2 className="text-xl font-semibold tracking-tight mb-4">{t("home.forYou")}</h2>
        <EventFeed events={events} onMarkRead={handleMarkRead} onMarkAllRead={handleMarkAllRead} />
      </div>

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
        <ThreadList
          threads={allThreadsSorted}
          onDelete={(threadId, e) => { e.stopPropagation(); setConfirmDeleteThreadId(threadId); }}
          channels={channels}
          pinnedIds={pinnedIds}
          onTogglePin={isOwner ? handleTogglePin : undefined}
        />
      )}
      <ConfirmDialog
        open={!!confirmDeleteThreadId}
        onOpenChange={(open) => { if (!open) setConfirmDeleteThreadId(null); }}
        title={t("home.confirmDeleteThread")}
        variant="destructive"
        onConfirm={async () => {
          if (confirmDeleteThreadId) {
            await handleDelete(confirmDeleteThreadId);
          }
          setConfirmDeleteThreadId(null);
        }}
      />
    </main>
  );
}
