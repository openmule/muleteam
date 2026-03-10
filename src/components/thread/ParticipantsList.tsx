"use client";

import { useState } from "react";

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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function ParticipantsList({
  participants,
  agents,
}: {
  participants: Participant[];
  agents: RegisteredAgent[];
}) {
  const [expanded, setExpanded] = useState(true);

  // Build a map of agent last_seen
  const agentMap = new Map(agents.map((a) => [a.id, a]));

  return (
    <div>
      <button
        className="flex items-center justify-between w-full px-4 py-3 text-left text-sm font-medium hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span>Participants</span>
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
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium shrink-0">
                  {isAgent ? "@" : getInitials(p.name)}
                </span>
                <span>{isAgent ? `@${p.name}` : p.name}</span>
                {agentInfo && (
                  <span className="text-xs text-muted-foreground">
                    &middot; seen {timeAgo(agentInfo.last_seen_at)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
