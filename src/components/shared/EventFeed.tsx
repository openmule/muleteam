"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { NotificationDot } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { MemberHoverCard } from "@/components/shared/MemberHoverCard";
import { timeAgo } from "@/components/shared/helpers";
import { CircleCheckBig, ChevronDown, ChevronUp } from "lucide-react";
import type { NotificationEvent } from "@/components/shared/types";

const COLLAPSED_LIMIT = 5;

function EventText({
  event,
  t,
  isRead,
}: {
  event: NotificationEvent;
  t: (key: string) => string;
  isRead: boolean;
}) {
  const textColor = isRead ? "text-[var(--label-tertiary)]" : "text-[var(--label-primary)]";
  const actorColor = isRead ? "text-[var(--label-tertiary)] hover:underline" : "text-[var(--label-primary)] font-medium hover:underline";

  const actorEl = (
    <MemberHoverCard participantId={event.actor_id}>
      <span
        className={`${actorColor} cursor-pointer`}
        onClick={(e) => e.stopPropagation()}
      >
        {event.actor_id.startsWith("agent:") ? `@${event.actor_name}` : event.actor_name}
      </span>
    </MemberHoverCard>
  );

  switch (event.type) {
    case "mention":
      return <span className={textColor}>{actorEl} {t("events.mentionedYou").split("{actor}")[1]?.split("{thread}")[0]}"{event.thread_title}"</span>;
    case "reply":
      return <span className={textColor}>{actorEl} {t("events.repliedToYou").split("{actor}")[1]?.split("{thread}")[0]}"{event.thread_title}"</span>;
    case "join":
      return <span className={textColor}>{actorEl} {t("events.addedYou").split("{actor}")[1]?.split("{thread}")[0]}"{event.thread_title}"</span>;
    case "status_change":
      return <span className={textColor}>"{event.thread_title}" marked as {event.body}</span>;
    case "task_assigned":
      return <span className={textColor}>{actorEl} {t("events.taskAssigned").split("{actor}")[1]?.split("{thread}")[0]}"{event.thread_title}"</span>;
    case "task_done":
      return <span className={textColor}>{actorEl} {t("events.taskDone").split("{actor}")[1]?.split("{thread}")[0]}"{event.thread_title}"</span>;
    default:
      return null;
  }
}

/*
 * Item with built-in top separator via ::before pseudo-element.
 * The first item has no separator (no before).
 * On hover: this item hides its own separator, and the next sibling hides its separator too.
 * Achieved purely via CSS adjacent sibling + :hover.
 *
 * Structure: each item is a single div with class "feed-row".
 * Separator is a ::before on every feed-row except :first-child.
 * On hover: .feed-row:hover::before is hidden, and .feed-row:hover + .feed-row::before is hidden.
 */

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

  const visibleEvents = expanded ? events : events.slice(0, COLLAPSED_LIMIT);
  const hasMore = events.length > COLLAPSED_LIMIT;

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[var(--radius-small-val)] border border-dashed border-border py-12 text-center px-4">
        <p className="text-muted-foreground text-sm">{t("events.noEvents")}</p>
      </div>
    );
  }

  return (
    <div className={`rounded-[var(--radius-medium-val)] border border-[var(--border-color-primary)] bg-[var(--bg-grouped-quaternary)] p-2 feed-container ${hasMore ? "pb-0" : ""}`}>
      {visibleEvents.map((event) => (
        <div
          key={event.id}
          className="feed-row relative flex items-center gap-3 w-full h-12 px-2 cursor-pointer rounded-[var(--radius-small-val)] hover:bg-[var(--fill-tertiary)] transition-colors"
          onClick={() => {
            if (!event.read) onMarkRead(event.id);
            router.push(`/thread/${event.thread_id}`);
          }}
        >
          {event.read ? (
            <Icon icon={CircleCheckBig} tint="tertiary" size={12} className="shrink-0" />
          ) : (
            <NotificationDot className="shrink-0" />
          )}
          <span className="flex-1 min-w-0 text-[length:var(--font-size-body-small)] truncate">
            <EventText event={event} t={t} isRead={event.read} />
          </span>
          <span className="text-[length:var(--font-size-caption)] text-[var(--label-tertiary)] shrink-0">
            {timeAgo(event.created_at)}
          </span>
        </div>
      ))}
      {hasMore && (
        <div className="feed-row-static relative flex items-center justify-center h-12">
          <Button variant="ghost" size="xs" onClick={() => setExpanded(!expanded)}>
            <Icon icon={expanded ? ChevronUp : ChevronDown} size={14} />
            {expanded
              ? t("events.showLess")
              : t("events.showMore").replace("{count}", String(events.length - COLLAPSED_LIMIT))}
          </Button>
        </div>
      )}
    </div>
  );
}
