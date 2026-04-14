"use client";

import { useRef, useEffect, useMemo } from "react";
import { ActivityItem } from "./ActivityItem";
import { useT } from "@/lib/i18n";

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

export function ActivityFeed({
  threadId,
  messages,
  onReply,
  currentUserId,
  scrollToken,
}: {
  threadId: string;
  messages: Message[];
  onReply?: (messageId: string) => void;
  currentUserId?: string;
  /** Increment to force scroll to bottom (e.g. after sending a message) */
  scrollToken?: number;
}) {
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);
  const prevThreadIdRef = useRef(threadId);

  const forceScrollRef = useRef(false);

  // Reset scroll state when switching threads
  if (threadId !== prevThreadIdRef.current) {
    prevCountRef.current = 0;
    prevThreadIdRef.current = threadId;
    forceScrollRef.current = false;
  }

  // Mark force-scroll when scrollToken changes (user sent a message)
  useEffect(() => {
    if (scrollToken) forceScrollRef.current = true;
  }, [scrollToken]);

  useEffect(() => {
    const viewport = containerRef.current;
    if (!viewport) return;

    const isInitialLoad = prevCountRef.current === 0 && messages.length > 0;
    const messageCountIncreased = messages.length > prevCountRef.current;
    const nearBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 200;

    if (isInitialLoad || forceScrollRef.current || (messageCountIncreased && nearBottom)) {
      if (isInitialLoad) {
        viewport.scrollTop = viewport.scrollHeight;
      } else {
        requestAnimationFrame(() => {
          viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
        });
      }
      forceScrollRef.current = false;
    }

    prevCountRef.current = messages.length;
  }, [messages]);

  // Build message lookup for reply targets
  const messageMap = useMemo(() => {
    const map = new Map<string, Message>();
    for (const msg of messages) {
      map.set(msg.id, msg);
    }
    return map;
  }, [messages]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain scrollbar-thin pt-0 pb-0" ref={containerRef}>
      <div className="pt-4 pb-8 flex flex-col gap-6">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-16">
            <p className="text-sm">{t("thread.noMessages")}</p>
          </div>
        )}
        {messages.map((msg) => (
          <ActivityItem
            key={msg.id}
            message={msg}
            threadId={threadId}
            replyTarget={msg.reply_to ? messageMap.get(msg.reply_to) : undefined}
            onReply={onReply}
            currentUserId={currentUserId}
          />
        ))}
      </div>
    </div>
  );
}
