"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/layout/AuthProvider";
import { useNavigation } from "@/components/layout/NavigationContext";
import { AtSign } from "lucide-react";
import { getChannelBadgeColor } from "@/components/layout/Sidebar";
import ThreadDetailPage from "@/app/(app)/thread/[threadId]/page";
import type { NotificationEvent, ThreadMeta } from "@/components/shared/types";

function formatEventBody(event: NotificationEvent): string {
  switch (event.type) {
    case "mention": return `${event.actor_name} mentioned you`;
    case "reply": return `${event.actor_name} replied to you`;
    case "join": return `${event.actor_name} added you`;
    case "status_change": return `Status changed to ${event.body}`;
    case "task_assigned": return `${event.actor_name} assigned you: ${event.body}`;
    case "task_done": return `${event.actor_name} completed: ${event.body}`;
    default: return event.body || "";
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

interface ThreadGroup {
  threadId: string;
  threadTitle: string;
  channelId?: string;
  channelName?: string;
  statusLabel?: string;
  status?: string;
  latestEvent?: NotificationEvent;
  hasUnread: boolean;
  lastMessagePreview?: string;
  lastMessageTime?: string;
  updatedAt: string;
}

export function ForYouPanel() {
  const { loading: authLoading } = useAuth();
  const { activeThreadId, setThread } = useNavigation();

  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [threads, setThreads] = useState<ThreadMeta[]>([]);
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [readThreadIds, setReadThreadIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    const [eventsRes, threadsRes, channelsRes] = await Promise.all([
      fetch("/api/events?limit=50"),
      fetch("/api/threads"),
      fetch("/api/channels"),
    ]);
    if (eventsRes.ok) setEvents((await eventsRes.json()).events ?? []);
    if (threadsRes.ok) setThreads((await threadsRes.json()).threads ?? []);
    if (channelsRes.ok) setChannels((await channelsRes.json()).channels ?? []);
  }, []);

  useEffect(() => {
    if (!authLoading) fetchData();
  }, [authLoading, fetchData]);

  // Build latest event per thread (for unread status)
  const latestEventByThread = new Map<string, NotificationEvent>();
  for (const event of events) {
    const existing = latestEventByThread.get(event.thread_id);
    if (!existing || new Date(event.created_at) > new Date(existing.created_at)) {
      latestEventByThread.set(event.thread_id, event);
    }
  }

  // Show ALL threads (not just those with events), sorted by updated_at
  const threadGroups: ThreadGroup[] = threads
    .filter((t) => t.status !== "archived")
    .map((thread) => {
      const event = latestEventByThread.get(thread.id);
      const channel = thread.channel_id ? channels.find((c) => c.id === thread.channel_id) : null;
      return {
        threadId: thread.id,
        threadTitle: thread.title,
        channelId: thread.channel_id,
        channelName: channel?.name,
        statusLabel: (thread as any)?.status_label,
        status: thread.status,
        latestEvent: event,
        hasUnread: event ? (!event.read && !readThreadIds.has(thread.id)) : false,
        lastMessagePreview: (thread as any)?.last_message?.body,
        lastMessageTime: (thread as any)?.last_message?.ts ? timeAgo(new Date((thread as any).last_message.ts).toISOString()) : undefined,
        updatedAt: thread.updated_at,
      };
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  // Auto-select first thread
  useEffect(() => {
    if (threadGroups.length > 0 && !selectedThreadId) {
      setSelectedThreadId(threadGroups[0].threadId);
    }
  }, [threadGroups.length, selectedThreadId]);

  const handleSelectThread = (threadId: string) => {
    setSelectedThreadId(threadId);
    setReadThreadIds((prev) => new Set(prev).add(threadId));
    // Mark events as read
    events
      .filter((e) => e.thread_id === threadId && !e.read)
      .forEach((e) => {
        fetch(`/api/events/${e.id}`, { method: "PATCH" });
      });
    setEvents((prev) => prev.map((e) => e.thread_id === threadId ? { ...e, read: true } : e));
    window.dispatchEvent(new Event("muleteam:events-changed"));
  };

  if (authLoading) return null;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: For You thread list */}
      <div className="w-[360px] shrink-0 h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex flex-col gap-3 px-6 pt-4 pb-4 shrink-0">
          <div className="flex items-center gap-2 h-8">
            <AtSign className="size-5 text-[var(--label-primary)]" strokeWidth={1.5} />
            <span className="text-xl font-semibold text-[var(--label-primary)]">For You</span>
          </div>
        </div>

        {/* Thread list */}
        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
          {threadGroups.length === 0 && (
            <div className="text-center text-[var(--label-tertiary)] py-16 text-sm">
              No notifications yet
            </div>
          )}
          {threadGroups.map((group) => {
            const isActive = group.threadId === selectedThreadId;
            const isUnread = group.hasUnread;
            const badgeColor = group.channelId ? getChannelBadgeColor(group.channelId) : null;

            return (
              <button
                key={group.threadId}
                onClick={() => handleSelectThread(group.threadId)}
                className={`flex flex-col w-full text-left p-4 my-px rounded-[8px] transition-colors cursor-pointer ${
                  isActive ? "bg-[var(--fill-quaternary)]" : "hover:bg-[var(--fill-quaternary)]"
                }`}
              >
                {/* Row 1: title + channel badge + red dot */}
                <div className="flex items-center gap-1.5 w-full min-w-0">
                  <span className={`text-sm truncate font-[500] text-[var(--label-primary)]`}>
                    {group.threadTitle}
                  </span>
                  {badgeColor && group.channelName && (
                    <span className={`text-[10px] px-1.5 h-4 inline-flex items-center rounded-full shrink-0 ${badgeColor.bg} ${badgeColor.text}`}>
                      {group.channelName}
                    </span>
                  )}
                  {isUnread && (
                    <span className="size-[6px] rounded-full bg-[var(--color-red-1000)] shrink-0 ml-auto" />
                  )}
                </div>
                {/* Row 2: event description + time */}
                <div className="flex items-center gap-2 w-full min-w-0 mt-2">
                  {group.statusLabel && (
                    <span className={`text-xs shrink-0 ${
                      group.status === "done" ? "text-[var(--color-green-1000)]"
                        : group.status === "in_progress" ? "text-[var(--color-cyan-1000)]"
                        : "text-[var(--color-orange-1000)]"
                    }`}>
                      {group.status === "done" ? "✓" : "●"} {group.statusLabel}
                    </span>
                  )}
                  <span className="text-xs truncate flex-1 text-[var(--label-secondary)]">
                    {group.latestEvent ? formatEventBody(group.latestEvent) : (group.lastMessagePreview || "")}
                  </span>
                  <span className="text-xs shrink-0 text-[var(--label-secondary)]">{group.latestEvent ? timeAgo(group.latestEvent.created_at) : (group.lastMessageTime || "")}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Thread detail */}
      <div className="flex-1 h-full min-w-0">
        {selectedThreadId && <ThreadDetailPage threadId={selectedThreadId} />}
      </div>
    </div>
  );
}
