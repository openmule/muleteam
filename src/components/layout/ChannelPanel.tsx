"use client";

import { useEffect, useState, useCallback } from "react";
import { useNavigation } from "@/components/layout/NavigationContext";
import { useAuth } from "@/components/layout/AuthProvider";
import { MemberAvatar } from "@/components/shared/MemberAvatar";
import { CreateChannelForm } from "@/components/shared/CreateChannelForm";
import { timeAgo } from "@/components/shared/helpers";
import { CHANNEL_CONFIG } from "@/components/layout/Sidebar";
import { Wand, EllipsisVertical, Pencil, ArrowUpDown, Bell, BellOff, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ThreadDetailPage from "@/app/(app)/thread/[threadId]/page";
import type { ThreadMeta, ChannelMeta, RegisteredAgent, User as UserType } from "@/components/shared/types";

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

export function ChannelPanel() {
  const { activeChannelId, activeThreadId, setThread } = useNavigation();
  const { loading: authLoading, user } = useAuth();

  const [channel, setChannel] = useState<ChannelMeta | null>(null);
  const [threads, setThreads] = useState<ThreadMeta[]>([]);
  const [agents, setAgents] = useState<RegisteredAgent[]>([]);
  const [allUsers, setAllUsers] = useState<UserType[]>([]);
  const [editOpen, setEditOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (!activeChannelId) return;
    const [channelRes, threadsRes, agentsRes, usersRes] = await Promise.all([
      fetch(`/api/channels/${activeChannelId}`),
      fetch("/api/threads"),
      fetch("/api/agents"),
      fetch("/api/users"),
    ]);
    if (channelRes.ok) {
      const data = await channelRes.json();
      setChannel(data.channel ?? data);
    }
    if (threadsRes.ok) {
      const all = (await threadsRes.json()).threads ?? [];
      const filtered = all.filter((t: ThreadMeta) => t.channel_id === activeChannelId);
      setThreads(filtered);
      // Auto-select first thread immediately
      const sorted = [...filtered].sort(
        (a: ThreadMeta, b: ThreadMeta) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      if (sorted.length > 0) {
        setThread(sorted[0].id);
      }
    }
    if (agentsRes.ok) setAgents((await agentsRes.json()).agents ?? []);
    if (usersRes.ok) setAllUsers((await usersRes.json()).users ?? []);
  }, [activeChannelId, setThread]);

  useEffect(() => {
    if (!authLoading && activeChannelId) fetchData();
  }, [authLoading, activeChannelId, fetchData]);

  const sortedThreads = [...threads].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  if (!activeChannelId || !channel) return null;

  const config = CHANNEL_CONFIG[activeChannelId] ?? { icon: Wand, color: "text-[var(--label-primary)]" };
  const ChannelIcon = config.icon;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Thread list — fixed 360px */}
      <div className="w-[360px] shrink-0 h-full flex flex-col overflow-hidden">
        {/* Channel header */}
        <div className="flex flex-col gap-3 px-6 pt-4 pb-4 shrink-0">
          <div className="flex items-center gap-2 h-8">
            <ChannelIcon className={`size-5 ${config.color}`} strokeWidth={1.25} />
            <span className="text-xl font-semibold text-[var(--label-primary)] flex-1">{channel.name}</span>
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center justify-center size-8 rounded-[6px] text-[var(--label-primary)] hover:bg-[var(--fill-quaternary)] transition-all focus:outline-none cursor-pointer shrink-0">
                <EllipsisVertical className="size-5" strokeWidth={1.5} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={4} className="w-[200px]">
                <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                  <Pencil className="h-4 w-4" strokeWidth={1.5} /> Edit Channel
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  <ArrowUpDown className="h-4 w-4" strokeWidth={1.5} /> Sort Threads
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  <Bell className="h-4 w-4" strokeWidth={1.5} /> Mute Notifications
                </DropdownMenuItem>
                <DropdownMenuSeparator className="mx-2" />
                <DropdownMenuItem disabled className="text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4" strokeWidth={1.5} /> Delete Channel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
            const isActive = thread.id === activeThreadId;
            const preview = thread.last_message
              ? stripMarkdown(thread.last_message.body)
              : thread.description ? stripMarkdown(thread.description) : "";
            const previewTime = thread.last_message
              ? timeAgoFromTs(thread.last_message.ts)
              : timeAgo(thread.updated_at);

            return (
              <button
                key={thread.id}
                onClick={() => setThread(thread.id)}
                className={`flex flex-col w-full text-left p-4 my-px rounded-[8px] transition-colors cursor-pointer ${
                  isActive
                    ? "bg-[var(--fill-quaternary)]"
                    : "hover:bg-[var(--fill-quaternary)]"
                }`}
              >
                <div className="flex items-center w-full min-w-0">
                  <span className={`text-sm truncate flex-1 font-[500] text-[var(--label-primary)]`}>
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

      {/* Right: Thread detail */}
      <div className="flex-1 h-full min-w-0">
        {activeThreadId && <ThreadDetailPage threadId={activeThreadId} showChannelBadge={false} />}
      </div>

      {/* Edit Channel Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Channel</DialogTitle>
          </DialogHeader>
          <CreateChannelForm
            agents={agents}
            users={allUsers}
            currentUserId={user?.id}
            editChannel={channel}
            onSuccess={() => {
              setEditOpen(false);
              fetchData();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
