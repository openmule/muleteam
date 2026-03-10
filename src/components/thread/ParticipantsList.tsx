"use client";

import { useState } from "react";
import Link from "next/link";
import { memberUrl } from "@/components/shared/helpers";
import { MemberAvatar } from "@/components/shared/MemberAvatar";

interface Participant {
  id: string;
  type: "human" | "agent";
  name: string;
}

interface RegisteredAgent {
  id: string;
  name: string;
  last_seen_at: string;
}

interface UserInfo {
  id: string;
  name: string;
  email: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function ParticipantsList({
  threadId,
  participants,
  agents,
  users,
  onParticipantAdded,
  readOnly,
}: {
  threadId: string;
  participants: Participant[];
  agents: RegisteredAgent[];
  users?: UserInfo[];
  onParticipantAdded?: () => void;
  readOnly?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [adding, setAdding] = useState(false);

  // Build a map of agent last_seen
  const agentMap = new Map(agents.map((a) => [a.id, a]));

  // Filter out participants already in the thread
  const participantIds = new Set(participants.map((p) => p.id));
  const availableAgents = agents.filter((a) => !participantIds.has(`agent:${a.id}`));
  const availableUsers = (users ?? []).filter((u) => !participantIds.has(`human:${u.id}`));
  const hasAvailable = availableAgents.length > 0 || availableUsers.length > 0;

  const handleAdd = async (participantId: string) => {
    setAdding(true);
    try {
      const res = await fetch(`/api/threads/${threadId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId }),
      });
      if (res.ok) {
        setShowPicker(false);
        onParticipantAdded?.();
      }
    } finally {
      setAdding(false);
    }
  };

  return (
    <div>
      <button
        className="flex items-center justify-between w-full px-4 py-3 text-left text-sm font-medium hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Participants
        </span>
        <span className="text-xs text-muted-foreground">{expanded ? "\u25B4" : "\u25BE"}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          {participants.map((p) => {
            const isAgent = p.type === "agent";
            const agentId = p.id.replace("agent:", "");
            const agentInfo = isAgent ? agentMap.get(agentId) : null;

            return (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                <MemberAvatar type={p.type} name={p.name} size={20} />
                <Link href={memberUrl(p.id)} className="hover:underline">
                  {isAgent ? `@${p.name}` : p.name}
                </Link>
                {agentInfo && (
                  <span className="text-xs text-muted-foreground">
                    &middot; seen {timeAgo(agentInfo.last_seen_at)}
                  </span>
                )}
              </div>
            );
          })}

          {/* Add participant button & picker */}
          {!readOnly && hasAvailable && !showPicker && (
            <button
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
              onClick={() => setShowPicker(true)}
            >
              <span className="text-sm">+</span> Add participant
            </button>
          )}

          {showPicker && (
            <div className="rounded-md border border-border divide-y divide-border mt-1 max-h-48 overflow-y-auto">
              {availableUsers.map((u) => (
                <button
                  key={`human:${u.id}`}
                  type="button"
                  disabled={adding}
                  onClick={() => handleAdd(`human:${u.id}`)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted/50 disabled:opacity-50"
                >
                  <MemberAvatar type="human" name={u.name} size={20} />
                  <span>{u.name}</span>
                </button>
              ))}
              {availableAgents.map((agent) => (
                <button
                  key={`agent:${agent.id}`}
                  type="button"
                  disabled={adding}
                  onClick={() => handleAdd(`agent:${agent.id}`)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted/50 disabled:opacity-50"
                >
                  <MemberAvatar type="agent" name={agent.name} size={20} />
                  <span>@{agent.name}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowPicker(false)}
                className="flex w-full items-center justify-center px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
