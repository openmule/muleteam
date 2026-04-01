"use client";

import Link from "next/link";
import { memberUrl } from "@/components/shared/helpers";
import { MemberHoverCard } from "@/components/shared/MemberHoverCard";
import { MarkdownBody } from "./MarkdownBody";

interface AnnotationAnchor {
  file_path: string;
  anchor_type: "line" | "selector";
  start_line?: number;
  end_line?: number;
  selector?: string;
  commit_hash: string;
  content_snapshot: string;
}

interface Message {
  id: string;
  ts: number;
  from: string;
  from_name: string;
  type: string;
  body: string;
  annotation?: AnnotationAnchor;
}

const USERNAME_COLORS = [
  "text-red-600 dark:text-red-400",
  "text-blue-600 dark:text-blue-400",
  "text-green-600 dark:text-green-400",
  "text-purple-600 dark:text-purple-400",
  "text-orange-600 dark:text-orange-400",
  "text-teal-600 dark:text-teal-400",
  "text-pink-600 dark:text-pink-400",
  "text-indigo-600 dark:text-indigo-400",
  "text-cyan-600 dark:text-cyan-400",
  "text-amber-600 dark:text-amber-400",
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

function anchorLabel(annotation: AnnotationAnchor): string {
  if (annotation.anchor_type === "line") {
    if (annotation.start_line === annotation.end_line || !annotation.end_line) {
      return `L${annotation.start_line}`;
    }
    return `L${annotation.start_line}-${annotation.end_line}`;
  }
  return annotation.selector || "element";
}

/** Single annotation message */
export function AnnotationItem({
  message,
  onNavigateToAnnotation,
}: {
  message: Message;
  onNavigateToAnnotation?: (messageId: string) => void;
}) {
  const annotation = message.annotation;
  if (!annotation) return null;

  const isAgent = message.from.startsWith("agent:");

  return (
    <div className="py-3 group/item" data-annotation-id={message.id}>
      {/* Author + file */}
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className="text-xs text-muted-foreground">📌</span>
        <MemberHoverCard participantId={message.from}>
          <Link href={memberUrl(message.from)} className={`text-sm font-medium hover:underline ${getUsernameColor(message.from)}`}>
            {isAgent ? `@${message.from_name}` : message.from_name}
          </Link>
        </MemberHoverCard>
        <span className="text-xs text-muted-foreground">on</span>
        <span className="text-xs font-mono text-muted-foreground">{annotation.file_path}</span>
        <span className="text-xs text-muted-foreground">{timeAgo(message.ts)}</span>
      </div>

      {/* Anchor snippet */}
      <div
        className="ml-5 mb-1.5 border-l-2 border-primary/30 pl-3 py-1 bg-primary/5 rounded-r-sm cursor-pointer hover:bg-primary/10 transition-colors"
        onClick={() => onNavigateToAnnotation?.(message.id)}
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-0.5">
          <span className="font-mono">{anchorLabel(annotation)}</span>
        </div>
        <div className="text-xs font-mono text-foreground/70 truncate max-w-md">
          {annotation.content_snapshot}
        </div>
      </div>

      {/* Comment body */}
      <div className="ml-5">
        <MarkdownBody body={message.body} />
      </div>

      {/* Navigate button */}
      {onNavigateToAnnotation && (
        <button
          className="ml-5 mt-1 text-xs text-primary/70 hover:text-primary transition-colors"
          onClick={() => onNavigateToAnnotation(message.id)}
        >
          View in Page →
        </button>
      )}
    </div>
  );
}

/** Folded group of consecutive annotations from same author on same file */
export function AnnotationGroup({
  messages,
  onNavigateToAnnotation,
}: {
  messages: Message[];
  onNavigateToAnnotation?: (messageId: string) => void;
}) {
  if (messages.length === 0) return null;
  if (messages.length === 1) {
    return <AnnotationItem message={messages[0]} onNavigateToAnnotation={onNavigateToAnnotation} />;
  }

  const first = messages[0];
  const annotation = first.annotation;
  if (!annotation) return null;

  const isAgent = first.from.startsWith("agent:");

  return (
    <div className="py-3" data-annotation-group={first.from}>
      {/* Group header */}
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-xs text-muted-foreground">📌</span>
        <MemberHoverCard participantId={first.from}>
          <Link href={memberUrl(first.from)} className={`text-sm font-medium hover:underline ${getUsernameColor(first.from)}`}>
            {isAgent ? `@${first.from_name}` : first.from_name}
          </Link>
        </MemberHoverCard>
        <span className="text-xs text-muted-foreground">
          — {messages.length} annotations on
        </span>
        <span className="text-xs font-mono text-muted-foreground">{annotation.file_path}</span>
      </div>

      {/* Individual annotations in group */}
      <div className="ml-5 space-y-2">
        {messages.map((msg) => {
          const ann = msg.annotation;
          if (!ann) return null;
          return (
            <div
              key={msg.id}
              className="border-l-2 border-primary/30 pl-3 py-1 bg-primary/5 rounded-r-sm cursor-pointer hover:bg-primary/10 transition-colors"
              onClick={() => onNavigateToAnnotation?.(msg.id)}
              data-annotation-id={msg.id}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-mono text-muted-foreground">{anchorLabel(ann)}</span>
                <span className="text-xs text-foreground/70 truncate max-w-xs">
                  "{ann.content_snapshot}"
                </span>
              </div>
              <div className="text-sm text-foreground/90">{msg.body}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
