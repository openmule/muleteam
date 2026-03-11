"use client";

import { useState, useMemo } from "react";
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 cursor-pointer"
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
}: {
  message: Message;
  threadId: string;
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
      {displayBody && (
        <div className="text-sm text-foreground/90 whitespace-pre-wrap break-words">
          {displayBody || "(Generated artifact — see workspace)"}
        </div>
      )}

      {/* No text and no images — show artifact fallback */}
      {!displayBody && imagePaths.length === 0 && isArtifact && (
        <div className="text-sm text-foreground/90 whitespace-pre-wrap break-words">
          (Generated artifact — see workspace)
        </div>
      )}

      {/* Inline images */}
      {imagePaths.length > 0 && (
        <InlineImages paths={imagePaths} threadId={threadId} />
      )}

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
