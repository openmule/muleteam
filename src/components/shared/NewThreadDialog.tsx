"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n";
import type { User, RegisteredAgent, ChannelMeta } from "./types";

function useIsMac() {
  return useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  }, []);
}

/**
 * Standalone form body for creating a new thread.
 * Used directly inside an externally-controlled Dialog (e.g. Sidebar).
 */
export function NewThreadForm({
  agents,
  users,
  channels,
  defaultChannelId,
  onCreated,
}: {
  agents: RegisteredAgent[];
  users?: User[];
  channels: ChannelMeta[];
  defaultChannelId?: string;
  onCreated?: () => void;
}) {
  const router = useRouter();
  const t = useT();
  const isMac = useIsMac();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    if (!defaultChannelId) return new Set();
    const channel = channels.find((c) => c.id === defaultChannelId);
    if (!channel) return new Set();
    return new Set(channel.members.map((m) => `${m.type}:${m.id}`));
  });
  const [selectedChannelId, setSelectedChannelId] = useState(defaultChannelId || "");
  const [creating, setCreating] = useState(false);

  // Derive locked member IDs from selected channel
  const lockedMemberIds = useMemo(() => {
    if (!selectedChannelId) return new Set<string>();
    const channel = channels.find((c) => c.id === selectedChannelId);
    if (!channel) return new Set<string>();
    return new Set(channel.members.map((m) => `${m.type}:${m.id}`));
  }, [selectedChannelId, channels]);

  const handleChannelChange = (channelId: string) => {
    setSelectedChannelId(channelId);
    if (!channelId) {
      const prevChannel = channels.find((c) => c.id === selectedChannelId);
      if (prevChannel) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          for (const m of prevChannel.members) {
            next.delete(`${m.type}:${m.id}`);
          }
          return next;
        });
      }
      return;
    }
    const channel = channels.find((c) => c.id === channelId);
    if (channel) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const m of channel.members) {
          next.add(`${m.type}:${m.id}`);
        }
        return next;
      });
    }
  };

  const toggleSelection = (id: string) => {
    if (lockedMemberIds.has(id)) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!title.trim() || creating) return;
    setCreating(true);
    try {
      const participantIds = Array.from(selectedIds);
      const res = await fetch("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          participantIds,
          channel_id: selectedChannelId || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTitle("");
        setDescription("");
        setSelectedIds(new Set());
        setSelectedChannelId("");
        onCreated?.();
        router.push(`/thread/${data.thread.id}`);
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="thread-title">{t("thread.title")}</Label>
        <Input
          id="thread-title"
          placeholder={t("thread.placeholder.title")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing && handleCreate()}
          autoFocus
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="thread-desc">{t("thread.description")}</Label>
        <Textarea
          id="thread-desc"
          placeholder={t("thread.placeholder.description")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </div>
      <div className="space-y-2">
        <Label>{t("thread.channel")}</Label>
        <select
          className="flex h-9 w-full rounded-md border border-border bg-transparent px-3 py-1 text-sm"
          value={selectedChannelId}
          onChange={(e) => handleChannelChange(e.target.value)}
        >
          <option value="">{t("thread.noChannel")}</option>
          {channels.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      {((users ?? []).length > 0 || agents.length > 0) && (
        <div className="space-y-2">
          <Label>{t("thread.participants")}</Label>
          <div className="rounded-md border border-border divide-y divide-border max-h-48 overflow-y-auto">
            {(users ?? []).map((u) => {
              const memberId = `human:${u.id}`;
              const selected = selectedIds.has(memberId);
              const locked = lockedMemberIds.has(memberId);
              return (
                <button
                  key={memberId}
                  type="button"
                  onClick={() => toggleSelection(memberId)}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
                    locked ? "opacity-70 cursor-default" : "hover:bg-muted/50"
                  } ${selected ? "bg-muted/30" : ""}`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] transition-colors ${
                      selected ? "border-foreground bg-foreground text-background" : "border-border"
                    }`}
                  >
                    {selected && "\u2713"}
                  </span>
                  <span className="font-medium">{u.name}</span>
                  {locked && <span className="text-[10px] text-muted-foreground ml-auto">{t("thread.channelMember")}</span>}
                </button>
              );
            })}
            {agents.map((agent) => {
              const memberId = `agent:${agent.id}`;
              const selected = selectedIds.has(memberId);
              const locked = lockedMemberIds.has(memberId);
              return (
                <button
                  key={memberId}
                  type="button"
                  onClick={() => toggleSelection(memberId)}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
                    locked ? "opacity-70 cursor-default" : "hover:bg-muted/50"
                  } ${selected ? "bg-muted/30" : ""}`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] transition-colors ${
                      selected ? "border-foreground bg-foreground text-background" : "border-border"
                    }`}
                  >
                    {selected && "\u2713"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">@{agent.name}</span>
                    {agent.description && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {agent.description}
                      </span>
                    )}
                  </div>
                  {locked && <span className="text-[10px] text-muted-foreground shrink-0">{t("thread.channelMember")}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <Button className="w-full" onClick={handleCreate} disabled={!title.trim() || creating}>
        {creating ? t("common.creating") : <>{t("thread.createThread")} <span className="ml-1 text-xs opacity-60">{isMac ? "\u2318\u21B5" : "Ctrl\u21B5"}</span></>}
      </Button>
    </div>
  );
}

/**
 * Self-contained Dialog + trigger button for creating a new thread.
 * Used on the Channels page where no external Dialog wrapper exists.
 */
export function NewThreadDialog({
  agents,
  users,
  channels,
  defaultChannelId,
  onCreated,
}: {
  agents: RegisteredAgent[];
  users?: User[];
  channels: ChannelMeta[];
  defaultChannelId?: string;
  onCreated?: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {t("thread.newThread")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("thread.newThreadTitle")}</DialogTitle>
        </DialogHeader>
        <DialogBody className="pt-2">
          <NewThreadForm
            agents={agents}
            users={users}
            channels={channels}
            defaultChannelId={defaultChannelId}
            onCreated={() => {
              setOpen(false);
              onCreated?.();
            }}
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
