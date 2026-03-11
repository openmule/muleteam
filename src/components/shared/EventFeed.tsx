"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { MemberAvatar } from "@/components/shared/MemberAvatar";
import { timeAgo } from "@/components/shared/helpers";
import type { NotificationEvent } from "@/components/shared/types";

const COLLAPSED_LIMIT = 5;

const TYPE_ICONS: Record<NotificationEvent["type"], string> = {
  mention: "@",
  reply: "\u21A9",   // ↩
  join: "+",
  status_change: "\u25CB", // ○
  task_assigned: "\u2610", // ☐
  task_done: "\u2611",     // ☑
};

function formatEventText(
  event: NotificationEvent,
  t: (key: string) => string
): string {
  switch (event.type) {
    case "mention":
      return t("events.mentionedYou")
        .replace("{actor}", event.actor_name)
        .replace("{thread}", event.thread_title);
    case "reply":
      return t("events.repliedToYou")
        .replace("{actor}", event.actor_name)
        .replace("{thread}", event.thread_title);
    case "join":
      return t("events.addedYou")
        .replace("{actor}", event.actor_name)
        .replace("{thread}", event.thread_title);
    case "status_change":
      return t("events.statusChanged")
        .replace("{thread}", event.thread_title)
        .replace("{status}", event.body ?? "");
    case "task_assigned":
      return t("events.taskAssigned")
        .replace("{actor}", event.actor_name)
        .replace("{thread}", event.thread_title)
        .replace("{description}", event.body ?? "");
    case "task_done":
      return t("events.taskDone")
        .replace("{actor}", event.actor_name)
        .replace("{thread}", event.thread_title)
        .replace("{description}", event.body ?? "");
    default:
      return "";
  }
}

export function EventFeed({
  events,
  onMarkRead,
  onMarkAllRead,
}: {
  events: NotificationEvent[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}) {
  const router = useRouter();
  const t = useT();
  const [expanded, setExpanded] = useState(false);

  const hasUnread = events.some((e) => !e.read);
  const visibleEvents = expanded ? events : events.slice(0, COLLAPSED_LIMIT);
  const hasMore = events.length > COLLAPSED_LIMIT;

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border py-12 text-center px-4">
        <p className="text-muted-foreground text-sm">{t("events.noEvents")}</p>
      </div>
    );
  }

  const actorType = (actorId: string): "human" | "agent" =>
    actorId.startsWith("agent:") ? "agent" : "human";

  return (
    <div>
      {hasUnread && (
        <div className="flex justify-end mb-2">
          <button
            onClick={onMarkAllRead}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("events.markAllRead")}
          </button>
        </div>
      )}
      <div className="divide-y divide-border rounded-md border border-border">
        {visibleEvents.map((event) => (
          <button
            key={event.id}
            onClick={() => {
              if (!event.read) onMarkRead(event.id);
              router.push(`/thread/${event.thread_id}`);
            }}
            className="flex items-start gap-3 w-full px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
          >
            {/* Unread indicator */}
            <span className="shrink-0 mt-1.5 w-2 h-2 rounded-full" style={{
              backgroundColor: event.read ? "transparent" : "var(--color-blue-500, #3b82f6)",
            }} />

            {/* Actor avatar */}
            <MemberAvatar
              type={actorType(event.actor_id)}
              name={event.actor_name}
              size={20}
            />

            {/* Icon + text */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground font-mono shrink-0">
                  {TYPE_ICONS[event.type]}
                </span>
                <span className="text-sm truncate">
                  {formatEventText(event, t)}
                </span>
              </div>
            </div>

            {/* Time */}
            <span className="text-xs text-muted-foreground shrink-0 mt-0.5">
              {timeAgo(event.created_at)}
            </span>
          </button>
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          {expanded
            ? t("events.showLess")
            : t("events.showMore").replace("{count}", String(events.length - COLLAPSED_LIMIT))}
        </button>
      )}
    </div>
  );
}
