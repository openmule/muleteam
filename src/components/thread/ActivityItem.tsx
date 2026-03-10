"use client";

import Link from "next/link";
import { memberUrl } from "@/components/shared/helpers";

interface Message {
  id: string;
  ts: number;
  from: string;
  from_name: string;
  type: "text" | "artifact" | "system" | "activity";
  body: string;
  artifact_version?: number;
  reply_to?: string;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function ActivityItem({
  message,
  replyTarget,
  onReply,
}: {
  message: Message;
  replyTarget?: Message;
  onReply?: (messageId: string) => void;
}) {
  const isAgent = message.from.startsWith("agent:");
  const isSystem = message.type === "system" || message.type === "activity";

  // System/activity messages: compact gray line
  if (isSystem) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        <span>{message.body}</span>
        <span>&middot;</span>
        <span>{timeAgo(message.ts)}</span>
        <div className="h-px flex-1 bg-border" />
      </div>
    );
  }

  // Artifact messages
  const isArtifact = message.type === "artifact";
  const displayBody = isArtifact
    ? message.body.replace(/```html\n[\s\S]*?```/g, "").trim()
    : message.body;

  return (
    <div className="py-4 group/item">
      {/* Reply context */}
      {replyTarget && (
        <div className="flex items-center gap-1.5 mb-2 pl-3 border-l-2 border-muted">
          <Link href={memberUrl(replyTarget.from)} className="text-xs font-medium text-muted-foreground hover:underline">
            {replyTarget.from.startsWith("agent:") ? `@${replyTarget.from_name}` : replyTarget.from_name}
          </Link>
          <span className="text-xs text-muted-foreground truncate max-w-[300px]">
            {replyTarget.body.slice(0, 80)}{replyTarget.body.length > 80 ? "..." : ""}
          </span>
        </div>
      )}

      {/* Author header */}
      <div className="flex items-baseline gap-2 mb-1">
        <Link href={memberUrl(message.from)} className="text-sm font-medium hover:underline">
          {isAgent ? `@${message.from_name}` : message.from_name}
        </Link>
        <span className="text-xs text-muted-foreground">{timeAgo(message.ts)}</span>
        {onReply && (
          <button
            onClick={() => onReply(message.id)}
            className="opacity-0 group-hover/item:opacity-100 transition-opacity text-xs text-muted-foreground hover:text-foreground ml-auto"
          >
            Reply
          </button>
        )}
      </div>

      {/* Body */}
      <div className="text-sm text-foreground/90 whitespace-pre-wrap break-words">
        {displayBody || "(Generated artifact — see workspace)"}
      </div>

      {/* Artifact version badge */}
      {isArtifact && message.artifact_version && (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
          v{message.artifact_version} created
        </div>
      )}
    </div>
  );
}
