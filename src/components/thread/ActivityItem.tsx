"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { memberUrl } from "@/components/shared/helpers";
import { MemberAvatar } from "@/components/shared/MemberAvatar";
import { MessageCircle } from "lucide-react";
import { MarkdownBody } from "./MarkdownBody";

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

// Deterministic username color based on participantId hash
const USERNAME_COLORS = [
  "text-[var(--color-red-1000)]",
  "text-[var(--color-blue-1000)]",
  "text-[var(--color-green-1000)]",
  "text-[var(--color-purple-1000)]",
  "text-[var(--color-orange-1000)]",
  "text-[var(--accent-secondary-1000)]",
  "text-[var(--color-pink-1000)]",
  "text-[var(--color-indigo-1000)]",
  "text-[var(--color-cyan-1000)]",
  "text-[var(--color-brown-1000)]",
];

function getUsernameColor(participantId: string): string {
  let hash = 0;
  for (let i = 0; i < participantId.length; i++) {
    hash = ((hash << 5) - hash + participantId.charCodeAt(i)) | 0;
  }
  return USERNAME_COLORS[Math.abs(hash) % USERNAME_COLORS.length];
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

// Regex to match ![image](path) patterns for inline images
const IMAGE_PATTERN = /!\[image\]\(([^)]+)\)/g;

function parseBodyWithImages(body: string, threadId: string): { textParts: string[]; imagePaths: string[] } {
  const textParts: string[] = [];
  const imagePaths: string[] = [];
  let lastIndex = 0;

  const regex = new RegExp(IMAGE_PATTERN.source, "g");
  let match;
  while ((match = regex.exec(body)) !== null) {
    textParts.push(body.slice(lastIndex, match.index));
    imagePaths.push(match[1]);
    lastIndex = match.index + match[0].length;
  }
  textParts.push(body.slice(lastIndex));

  return { textParts, imagePaths };
}

function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-primary)] cursor-pointer"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl z-10"
      >
        &times;
      </button>
      <img
        src={src}
        alt={alt}
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

function InlineImages({ paths, threadId }: { paths: string[]; threadId: string }) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  if (paths.length === 0) return null;

  const gridClass = paths.length === 1
    ? "grid-cols-1 max-w-xs"
    : "grid-cols-2 max-w-sm";

  return (
    <>
      <div className={`grid gap-1.5 mt-2 ${gridClass}`}>
        {paths.map((p, i) => {
          const src = `/api/threads/${threadId}/workspace/${p}`;
          return (
            <button
              key={i}
              className="relative overflow-hidden rounded-md border border-border hover:border-foreground/30 transition-colors"
              onClick={() => setLightboxSrc(src)}
            >
              <img
                src={src}
                alt={`Image ${i + 1}`}
                className="w-full h-auto max-h-48 object-cover"
                loading="lazy"
              />
            </button>
          );
        })}
      </div>
      {lightboxSrc && (
        <ImageLightbox
          src={lightboxSrc}
          alt="Full size image"
          onClose={() => setLightboxSrc(null)}
        />
      )}
    </>
  );
}

export function ActivityItem({
  message,
  threadId,
  replyTarget,
  onReply,
  currentUserId,
}: {
  message: Message;
  threadId: string;
  replyTarget?: Message;
  onReply?: (messageId: string) => void;
  currentUserId?: string;
}) {
  const isAgent = message.from.startsWith("agent:");
  const isSystem = message.type === "system" || message.type === "activity";
  const isOwnMessage = currentUserId ? message.from === `human:${currentUserId}` : false;

  // System/activity messages: compact centered line
  if (isSystem) {
    return (
      <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
        <span>{message.body}</span>
        <span>&middot;</span>
        <span>{timeAgo(message.ts)}</span>
      </div>
    );
  }

  // Artifact messages
  const isArtifact = message.type === "artifact";
  const rawBody = isArtifact
    ? message.body.replace(/```html\n[\s\S]*?```/g, "").trim()
    : message.body;

  // Parse out image references
  const { textParts, imagePaths } = useMemo(
    () => parseBodyWithImages(rawBody, threadId),
    [rawBody, threadId]
  );

  // Reconstruct text body without image markdown
  const displayBody = textParts.join("").trim();

  return (
    <div className="group/item">
      {/* Reply context */}
      {replyTarget && (
        <div className={`flex items-center gap-1.5 mb-2 pl-3 border-l-2 border-muted ${isOwnMessage ? "pl-16 pr-6" : "pl-6 pr-16"}`}>
          <Link href={memberUrl(replyTarget.from)} className="text-xs font-medium text-muted-foreground hover:underline">
            {replyTarget.from.startsWith("agent:") ? `@${replyTarget.from_name}` : replyTarget.from_name}
          </Link>
          <span className="text-xs text-muted-foreground truncate max-w-[300px]">
            {replyTarget.body.slice(0, 80)}{replyTarget.body.length > 80 ? "..." : ""}
          </span>
        </div>
      )}

      {isOwnMessage ? (
        /* ── Own message: right-aligned with avatar ── */
        <div className="flex gap-2 items-start justify-end pl-16 pr-6">
          <div className="flex flex-col items-end gap-[7px] flex-1 min-w-0">
            {/* Name + time (right-aligned) */}
            <div className="flex items-center gap-1">
              <span className="text-[length:var(--font-size-subheadline)] text-[var(--label-secondary)] opacity-0 group-hover/item:opacity-100 transition-opacity">{timeAgo(message.ts)}</span>
              <Link href={memberUrl(message.from)} className="text-[length:var(--font-size-body-small)] font-semibold text-[var(--label-primary)] hover:underline">
                {message.from_name}
              </Link>
            </div>
            {/* Message bubble — width fits content, min 48px, max aligns with others' left edge */}
            <div className="bg-[var(--fill-quaternary)] rounded-[8px] px-4 py-3 max-w-[calc(100%-64px+24px)] w-fit flex flex-col gap-4">
              {displayBody && <MarkdownBody body={displayBody} />}
              {imagePaths.length > 0 && <InlineImages paths={imagePaths} threadId={threadId} />}
              {!displayBody && imagePaths.length === 0 && isArtifact && (
                <span className="text-[length:var(--font-size-body-base)] text-foreground/90">(Generated artifact — see workspace)</span>
              )}
              {isArtifact && message.artifact_version && (
                <div className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
                  v{message.artifact_version} created
                </div>
              )}
            </div>
          </div>
          {/* Avatar */}
          <div className="mt-[2px] shrink-0">
            <MemberAvatar type="human" name={message.from_name} size={20} avatarUrl={undefined} />
          </div>
        </div>
      ) : (
        /* ── Others' message: left-aligned with avatar ── */
        <div className="flex gap-2 items-start pl-6 pr-6">
          {/* Avatar */}
          <div className="mt-[2px] shrink-0">
            <MemberAvatar type={isAgent ? "agent" : "human"} name={message.from_name} size={20} />
          </div>
          <div className="flex flex-col gap-[7px] flex-1 min-w-0 mr-[28px]">
            {/* Name + time */}
            <div className="flex items-center gap-1">
              <Link href={memberUrl(message.from)} className="text-[length:var(--font-size-body-small)] font-semibold text-[var(--label-primary)] hover:underline">
                {isAgent ? `@${message.from_name}` : message.from_name}
              </Link>
              <span className="text-[length:var(--font-size-subheadline)] text-[var(--label-secondary)] opacity-0 group-hover/item:opacity-100 transition-opacity">{timeAgo(message.ts)}</span>
              {onReply && (
                <button
                  onClick={() => onReply(message.id)}
                  className="opacity-0 group-hover/item:opacity-100 transition-opacity text-xs text-muted-foreground hover:text-foreground ml-auto flex items-center gap-0.5"
                >
                  <MessageCircle className="size-3" strokeWidth={1.5} />
                  Reply
                </button>
              )}
            </div>
            {/* Message body */}
            <div className="flex flex-col gap-4">
              {displayBody && <MarkdownBody body={displayBody} />}
              {!displayBody && imagePaths.length === 0 && isArtifact && (
                <span className="text-[length:var(--font-size-body-base)] text-foreground/90">(Generated artifact — see workspace)</span>
              )}
              {imagePaths.length > 0 && <InlineImages paths={imagePaths} threadId={threadId} />}
              {isArtifact && message.artifact_version && (
                <div className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
                  v{message.artifact_version} created
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
