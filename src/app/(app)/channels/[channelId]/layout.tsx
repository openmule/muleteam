"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/layout/AuthProvider";
import { MemberAvatar } from "@/components/shared/MemberAvatar";
import { timeAgo } from "@/components/shared/helpers";
import { CHANNEL_CONFIG } from "@/components/layout/Sidebar";
import { Wand } from "lucide-react";
import ThreadDetailPage from "@/app/(app)/thread/[threadId]/page";
import type { ThreadMeta, ChannelMeta } from "@/components/shared/types";

function timeAgoFromTs(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/\n/g, " ")
    .trim();
}

function statusColor(status: string): string {
  switch (status) {
    case "in_progress": return "text-[var(--color-cyan-1000)]";
    case "done": return "text-[var(--color-green-1000)]";
    case "archived": return "text-[var(--label-tertiary)]";
    default: return "text-[var(--color-orange-1000)]";
  }
}

export default function ChannelLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const { loading: authLoading } = useAuth();
  const channelId = params.channelId as string;

  const [channel, setChannel] = useState<ChannelMeta | null>(null);
  const [threads, setThreads] = useState<ThreadMeta[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const [channelRes, threadsRes] = await Promise.all([
      fetch(`/api/channels/${channelId}`),
      fetch("/api/threads"),
    ]);
    if (channelRes.ok) {
      const data = await channelRes.json();
      setChannel(data.channel ?? data);
    }
    if (threadsRes.ok) {
      const all = (await threadsRes.json()).threads ?? [];
      const filtered = all.filter((t: ThreadMeta) => t.channel_id === channelId);
      setThreads(filtered);
      // Auto-select first thread
      const sorted = [...filtered].sort(
        (a: ThreadMeta, b: ThreadMeta) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      if (sorted.length > 0) {
        setSelectedThreadId(sorted[0].id);
      }
    }
    setInitialLoading(false);
  }, [channelId]);

  // Reset selected thread when channel changes
  useEffect(() => {
    setSelectedThreadId(null);
    setInitialLoading(!channel);
    fetchData();
  }, [channelId]);

  useEffect(() => {
    if (!authLoading) fetchData();
  }, [authLoading, fetchData]);

  // Sync selectedThreadId from URL on initial load
  useEffect(() => {
    const isThreadView = pathname.includes("/thread/");
    if (isThreadView) {
      const id = pathname.split("/thread/")[1]?.split("/")[0];
      if (id) setSelectedThreadId(id);
    }
  }, [pathname]);

  if (initialLoading && !channel) {
    return (
      <div className="flex items-center justify-center py-20 flex-1">
        <div className="animate-pulse text-[var(--label-secondary)] text-sm">Loading...</div>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="flex items-center justify-center py-20 flex-1">
        <p className="text-[var(--label-secondary)] text-sm">Channel not found</p>
      </div>
    );
  }

  const sortedThreads = [...threads].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  const config = CHANNEL_CONFIG[channelId] ?? { icon: Wand, color: "text-[var(--label-primary)]" };
  const ChannelIcon = config.icon;

  const handleSelectThread = (threadId: string) => {
    setSelectedThreadId(threadId);
    // Update URL without causing a full page remount
    window.history.replaceState(null, "", `/channels/${channelId}/thread/${threadId}`);
  };

  return (
    <div className="relative flex h-full overflow-hidden">
      {/* Left: Thread list — fixed 360px */}
      <div className="w-[360px] shrink-0 h-full flex flex-col overflow-hidden">
        {/* Channel header (compact) */}
        <div className="flex flex-col gap-3 px-6 pt-4 pb-4 shrink-0">
          <div className="flex items-center gap-2 h-8">
            <ChannelIcon className={`size-5 ${config.color}`} strokeWidth={1.25} />
            <span className="text-xl font-semibold text-[var(--label-primary)]">{channel.name}</span>
          </div>
          <p className="text-sm text-[var(--label-secondary)] leading-snug">{channel.description}</p>
          <div className="flex items-center gap-1 text-sm text-[var(--label-secondary)]">
            <div className="flex -space-x-2 mr-2">
              {channel.members.slice(0, 4).map((m) => (
                <MemberAvatar key={m.id} type={m.type} name={m.name} size={20} />
              ))}
            </div>
            <span>{channel.members.length} members</span>
            <span>·</span>
            <span>{sortedThreads.length} threads</span>
          </div>
        </div>

        {/* Thread list */}
        <div className="flex-1 overflow-y-auto p-2">
          {sortedThreads.map((thread) => {
            const isActive = thread.id === selectedThreadId;
            const preview = thread.last_message
              ? stripMarkdown(thread.last_message.body)
              : thread.description ? stripMarkdown(thread.description) : "";
            const previewTime = thread.last_message
              ? timeAgoFromTs(thread.last_message.ts)
              : timeAgo(thread.updated_at);

            return (
              <button
                key={thread.id}
                onClick={() => handleSelectThread(thread.id)}
                className={`flex flex-col w-full text-left p-4 my-px rounded-[8px] transition-colors cursor-pointer ${
                  isActive
                    ? "bg-[var(--fill-quaternary)]"
                    : "hover:bg-[var(--fill-quaternary)]"
                }`}
              >
                <div className="flex items-center w-full min-w-0">
                  <span className={`text-sm truncate flex-1 ${isActive ? "font-semibold" : ""} text-[var(--label-primary)]`}>
                    {thread.title}
                  </span>
                </div>
                <div className="flex items-center gap-2 w-full min-w-0 mt-2">
                  {thread.status_label && (
                    <div className="flex items-center gap-1 shrink-0">
                      <span className={`text-xs ${statusColor(thread.status)}`}>
                        {thread.status === "done" ? "✓" : "●"} {thread.status_label}
                      </span>
                    </div>
                  )}
                  <span className="text-xs truncate flex-1 text-[var(--label-secondary)]">
                    {preview}
                  </span>
                  <span className="text-xs shrink-0 text-[var(--label-secondary)]">{previewTime}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Thread detail — rendered directly, no route remount */}
      <div className="flex-1 h-full min-w-0">
        {selectedThreadId && <ThreadDetailPage threadId={selectedThreadId} />}
      </div>
    </div>
  );
}
