"use client";

import { useRef, useEffect, useMemo } from "react";
import { ActivityItem } from "./ActivityItem";
import { ScrollArea } from "@/components/ui/scroll-area";
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
}: {
  threadId: string;
  messages: Message[];
  onReply?: (messageId: string) => void;
}) {
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  useEffect(() => {
    // Find the actual scrollable viewport inside ScrollArea
    const viewport = containerRef.current?.querySelector(
      "[data-slot='scroll-area-viewport']"
    ) as HTMLElement | null;

    if (!viewport) return;

    const isInitialLoad = prevCountRef.current === 0 && messages.length > 0;
    const nearBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 100;

    if (isInitialLoad || nearBottom) {
      // Use viewport.scrollTop instead of scrollIntoView to avoid
      // scrolling ancestor containers (which hides the navbar on mobile)
      if (isInitialLoad) {
        viewport.scrollTop = viewport.scrollHeight;
      } else {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
      }
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
    <ScrollArea className="flex-1 min-h-0" ref={containerRef}>
      <div className="px-6 py-4 divide-y divide-border">
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
          />
        ))}
      </div>
    </ScrollArea>
  );
}
