"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { User, RegisteredAgent, ChannelMeta } from "./types";

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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedChannelId, setSelectedChannelId] = useState(defaultChannelId || "");
  const [creating, setCreating] = useState(false);

  const toggleSelection = (id: string) => {
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
        setOpen(false);
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
    <Dialog open={open} onOpenChange={(o) => {
      setOpen(o);
      if (!o) {
        setSelectedChannelId("");
      } else if (defaultChannelId) {
        setSelectedChannelId(defaultChannelId);
      }
    }}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        + New Thread
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Thread</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="thread-title">Title</Label>
            <Input
              id="thread-title"
              placeholder="e.g. Landing page redesign"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="thread-desc">Description</Label>
            <Textarea
              id="thread-desc"
              placeholder="Describe the goal..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Channel (optional)</Label>
            <select
              className="flex h-9 w-full rounded-md border border-border bg-transparent px-3 py-1 text-sm"
              value={selectedChannelId}
              onChange={(e) => setSelectedChannelId(e.target.value)}
            >
              <option value="">No channel</option>
              {channels.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          {((users ?? []).length > 0 || agents.length > 0) && (
            <div className="space-y-2">
              <Label>Participants</Label>
              <div className="rounded-md border border-border divide-y divide-border max-h-48 overflow-y-auto">
                {(users ?? []).map((u) => {
                  const memberId = `human:${u.id}`;
                  const selected = selectedIds.has(memberId);
                  return (
                    <button
                      key={memberId}
                      type="button"
                      onClick={() => toggleSelection(memberId)}
                      className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50 ${
                        selected ? "bg-muted/30" : ""
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] transition-colors ${
                          selected ? "border-foreground bg-foreground text-background" : "border-border"
                        }`}
                      >
                        {selected && "\u2713"}
                      </span>
                      <span className="font-medium">{u.name}</span>
                    </button>
                  );
                })}
                {agents.map((agent) => {
                  const memberId = `agent:${agent.id}`;
                  const selected = selectedIds.has(memberId);
                  return (
                    <button
                      key={memberId}
                      type="button"
                      onClick={() => toggleSelection(memberId)}
                      className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50 ${
                        selected ? "bg-muted/30" : ""
                      }`}
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
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <Button className="w-full" onClick={handleCreate} disabled={!title.trim() || creating}>
            {creating ? "Creating..." : "Create Thread"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
