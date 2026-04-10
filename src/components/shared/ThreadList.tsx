"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import type { ThreadMeta, ChannelMeta } from "./types";
import { STATUS_ICON, timeAgo } from "./helpers";
import { MemberAvatar } from "./MemberAvatar";

export function ThreadList({
  threads,
  onDelete,
  channels,
  pinnedIds,
  onTogglePin,
  userAvatars,
}: {
  threads: ThreadMeta[];
  onDelete?: (threadId: string, e: React.MouseEvent) => void;
  channels?: ChannelMeta[];
  pinnedIds?: Set<string>;
  onTogglePin?: (threadId: string, pinned: boolean) => void;
  userAvatars?: Map<string, string | null>;
}) {
  const router = useRouter();
  const t = useT();
  const channelMap = new Map((channels ?? []).map((p) => [p.id, p]));

  return (
    <div className="list-container rounded-[var(--radius-medium-val)] border border-[var(--border-color-primary)] bg-[var(--bg-grouped-quaternary)] p-2">
      {threads.map((thread) => {
        const channel = thread.channel_id ? channelMap.get(thread.channel_id) : undefined;
        return (
          <div
            key={thread.id}
            className="list-row group relative flex items-center gap-4 h-12 px-2 cursor-pointer rounded-[var(--radius-small-val)] transition-colors hover:bg-[var(--fill-tertiary)]"
            onClick={() => router.push(`/thread/${thread.id}`)}
          >
            <span className="text-[length:var(--font-size-caption)] text-[var(--label-tertiary)] w-4 text-center font-mono shrink-0" title={thread.status}>
              {STATUS_ICON[thread.status] || "\u25CB"}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {pinnedIds?.has(thread.id) && (
                  <svg className="w-3.5 h-3.5 text-[var(--label-tertiary)] shrink-0" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M16 2l-4 4-5 3-3-1-2 2 5 5-4 6 6-4 5 5 2-2-1-3 3-5 4-4V2z"/></svg>
                )}
                <span className="text-[length:var(--font-size-body-small)] font-medium text-[var(--label-primary)] truncate">{thread.title}</span>
                {channel && (
                  <span className="inline-flex h-5 items-center rounded bg-[var(--fill-quaternary)] px-1.5 text-[length:var(--font-size-caption)] font-medium text-[var(--label-tertiary)] shrink-0">
                    {channel.name}
                  </span>
                )}
                <span className="text-[length:var(--font-size-caption)] text-[var(--label-tertiary)] shrink-0 hidden sm:inline">
                  {thread.status.replace("_", " ")} · {timeAgo(thread.updated_at)}
                </span>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 shrink-0">
              {thread.participants.slice(0, 4).map((p) => (
                <MemberAvatar key={p.id} type={p.type} name={p.name} size={20} avatarUrl={p.type === "human" ? userAvatars?.get(p.id.split(":").slice(1).join(":")) : undefined} />
              ))}
              {thread.participants.length > 4 && (
                <span className="text-[length:var(--font-size-caption)] text-[var(--label-tertiary)]">+{thread.participants.length - 4}</span>
              )}
            </div>
            {onTogglePin && (
              <button
                onClick={(e) => { e.stopPropagation(); onTogglePin(thread.id, !!pinnedIds?.has(thread.id)); }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-[var(--label-tertiary)] hover:text-[var(--label-primary)]"
                title={pinnedIds?.has(thread.id) ? t("pin.unpin") : t("pin.pin")}
                aria-label={pinnedIds?.has(thread.id) ? t("pin.unpin") : t("pin.pin")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill={pinnedIds?.has(thread.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 2l-4 4-5 3-3-1-2 2 5 5-4 6 6-4 5 5 2-2-1-3 3-5 4-4V2z"/></svg>
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => onDelete(thread.id, e)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-[var(--label-tertiary)] hover:text-destructive"
                title={t("common.delete")}
                aria-label={t("common.delete")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
