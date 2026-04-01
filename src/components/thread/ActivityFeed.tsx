"use client";

import { useRef, useEffect, useMemo, useCallback } from "react";
import { ActivityItem } from "./ActivityItem";
import { AnnotationItem, AnnotationGroup } from "./AnnotationItem";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useT } from "@/lib/i18n";

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
  type: "text" | "artifact" | "system" | "activity" | "annotation";
  body: string;
  artifact_version?: number;
  reply_to?: string;
  annotation?: AnnotationAnchor;
}

/** Group consecutive annotation messages from same author on same file */
type FeedItem =
  | { kind: "message"; message: Message }
  | { kind: "annotation-group"; messages: Message[] };

function groupMessages(messages: Message[]): FeedItem[] {
  const items: FeedItem[] = [];
  let annotationBuf: Message[] = [];

  const flushAnnotations = () => {
    if (annotationBuf.length === 0) return;
    items.push({ kind: "annotation-group", messages: [...annotationBuf] });
    annotationBuf = [];
  };

  for (const msg of messages) {
    if (msg.type === "annotation" && msg.annotation) {
      // Check if continues current group (same author, same file)
      if (
        annotationBuf.length > 0 &&
        annotationBuf[0].from === msg.from &&
        annotationBuf[0].annotation?.file_path === msg.annotation.file_path
      ) {
        annotationBuf.push(msg);
      } else {
        flushAnnotations();
        annotationBuf.push(msg);
      }
    } else {
      flushAnnotations();
      items.push({ kind: "message", message: msg });
    }
  }
  flushAnnotations();

  return items;
}

export function ActivityFeed({
  threadId,
  messages,
  onReply,
  onNavigateToAnnotation,
}: {
  threadId: string;
  messages: Message[];
  onReply?: (messageId: string) => void;
  onNavigateToAnnotation?: (messageId: string) => void;
}) {
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  useEffect(() => {
    const viewport = containerRef.current?.querySelector(
      "[data-slot='scroll-area-viewport']"
    ) as HTMLElement | null;

    if (!viewport) return;

    const isInitialLoad = prevCountRef.current === 0 && messages.length > 0;
    const nearBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 100;

    if (isInitialLoad || nearBottom) {
      if (isInitialLoad) {
        viewport.scrollTop = viewport.scrollHeight;
      } else {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
      }
    }

    prevCountRef.current = messages.length;
  }, [messages]);

  const messageMap = useMemo(() => {
    const map = new Map<string, Message>();
    for (const msg of messages) {
      map.set(msg.id, msg);
    }
    return map;
  }, [messages]);

  const feedItems = useMemo(() => groupMessages(messages), [messages]);

  /** Scroll a specific message into view (for Page → Thread navigation) */
  const scrollToMessage = useCallback((messageId: string) => {
    const viewport = containerRef.current?.querySelector(
      "[data-slot='scroll-area-viewport']"
    ) as HTMLElement | null;
    if (!viewport) return;

    const el = viewport.querySelector(`[data-annotation-id="${messageId}"]`) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("bg-primary/10");
      setTimeout(() => el.classList.remove("bg-primary/10"), 2000);
    }
  }, []);

  return (
    <ScrollArea className="flex-1 min-h-0" ref={containerRef}>
      <div className="px-6 py-4 divide-y divide-border">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-16">
            <p className="text-sm">{t("thread.noMessages")}</p>
          </div>
        )}
        {feedItems.map((item, i) => {
          if (item.kind === "annotation-group") {
            const key = item.messages.map(m => m.id).join(",");
            if (item.messages.length === 1) {
              return (
                <AnnotationItem
                  key={key}
                  message={item.messages[0]}
                  onNavigateToAnnotation={onNavigateToAnnotation}
                />
              );
            }
            return (
              <AnnotationGroup
                key={key}
                messages={item.messages}
                onNavigateToAnnotation={onNavigateToAnnotation}
              />
            );
          }
          const msg = item.message;
          return (
            <ActivityItem
              key={msg.id}
              message={msg}
              threadId={threadId}
              replyTarget={msg.reply_to ? messageMap.get(msg.reply_to) : undefined}
              onReply={onReply}
            />
          );
        })}
      </div>
    </ScrollArea>
  );
}
