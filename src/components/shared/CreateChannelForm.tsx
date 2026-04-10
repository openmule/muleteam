"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n";
import type { User, RegisteredAgent, Participant, ChannelMeta } from "./types";

export function CreateChannelForm({
  agents,
  users,
  currentUserId,
  onSuccess,
  editChannel,
}: {
  agents: RegisteredAgent[];
  users: User[];
  currentUserId?: string;
  onSuccess: () => void;
  /** If provided, form is in edit mode */
  editChannel?: ChannelMeta;
}) {
  const t = useT();
  const isEdit = !!editChannel;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Populate form when editing
  useEffect(() => {
    if (editChannel) {
      setName(editChannel.name);
      setDescription(editChannel.description || "");
      setSelectedMembers(new Set(editChannel.members.map((m) => m.id)));
    }
  }, [editChannel]);

  const toggleMember = (id: string) => {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const buildMembers = (): Participant[] => {
    const members: Participant[] = [];
    for (const memberId of selectedMembers) {
      if (memberId.startsWith("agent:")) {
        const agent = agents.find(a => a.id === memberId.replace("agent:", ""));
        if (agent) members.push({ id: memberId, type: "agent", name: agent.name });
      } else {
        const u = users.find(usr => `human:${usr.id}` === memberId);
        if (u) members.push({ id: memberId, type: "human", name: u.name });
      }
    }
    return members;
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError("");
    try {
      if (isEdit) {
        // Update channel
        const res = await fetch(`/api/channels/${editChannel!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || undefined,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Failed to update");
          return;
        }
        // Sync members — add new, remove old
        const currentMemberIds = new Set(editChannel!.members.map((m) => m.id));
        const newMembers = buildMembers();
        const newMemberIds = new Set(newMembers.map((m) => m.id));

        // Add new members
        for (const m of newMembers) {
          if (!currentMemberIds.has(m.id)) {
            await fetch(`/api/channels/${editChannel!.id}/members`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(m),
            });
          }
        }
        // Note: removing members would need individual DELETE calls per member
        // For now we only handle adding
      } else {
        // Create channel
        const res = await fetch("/api/channels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || undefined,
            members: buildMembers(),
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || t("channels.failedToCreate"));
          return;
        }
      }
      onSuccess();
    } catch {
      setError(t("auth.requestFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 pt-2">
      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
      )}
      <div className="space-y-2">
        <Label>{t("channels.channelName")}</Label>
        <Input placeholder={t("channels.placeholder.name")} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <div className="space-y-2">
        <Label>{t("channels.description")}</Label>
        <Input placeholder={t("channels.placeholder.description")} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>{t("channels.members")}</Label>
        <div className="rounded-md border border-border divide-y divide-border max-h-48 overflow-y-auto">
          {users.map((u) => {
            const memberId = `human:${u.id}`;
            const selected = selectedMembers.has(memberId);
            const isCurrentUser = u.id === currentUserId;
            return (
              <button
                key={memberId}
                type="button"
                onClick={() => toggleMember(memberId)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50 ${
                  selected ? "bg-muted/30" : ""
                }`}
              >
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] transition-colors ${
                  selected ? "border-foreground bg-foreground text-background" : "border-border"
                }`}>
                  {selected && "\u2713"}
                </span>
                <span className="font-medium">{u.name}{isCurrentUser ? ` ${t("members.you")}` : ""}</span>
              </button>
            );
          })}
          {agents.map((agent) => {
            const memberId = `agent:${agent.id}`;
            const selected = selectedMembers.has(memberId);
            return (
              <button
                key={memberId}
                type="button"
                onClick={() => toggleMember(memberId)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50 ${
                  selected ? "bg-muted/30" : ""
                }`}
              >
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] transition-colors ${
                  selected ? "border-foreground bg-foreground text-background" : "border-border"
                }`}>
                  {selected && "\u2713"}
                </span>
                <span className="font-medium">@{agent.name}</span>
              </button>
            );
          })}
        </div>
      </div>
      <Button className="w-full" onClick={handleSubmit} disabled={!name.trim() || loading}>
        {loading ? t("common.saving") : isEdit ? t("common.save") : t("channels.createChannel")}
      </Button>
    </div>
  );
}
