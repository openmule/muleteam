"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { MemberAvatar } from "./MemberAvatar";
import { memberUrl, timeAgo } from "./helpers";
import { useT } from "@/lib/i18n";

interface MemberData {
  type: "human" | "agent";
  name: string;
  description?: string;
  capabilities?: string[];
  created_at?: string;
  created_by?: { id: string; name: string };
  invited_by?: { id: string; name: string };
  last_seen_at?: string;
  team_role?: string;
}

/**
 * Hover card for members — shows a Discord-style popup with member info.
 *
 * @param participantId "agent:<id>" or "human:<id>"
 * @param children      Trigger element (e.g. the member's name link)
 */
export function MemberHoverCard({
  participantId,
  children,
}: {
  participantId: string;
  children: React.ReactNode;
}) {
  const t = useT();
  const [visible, setVisible] = useState(false);
  const [data, setData] = useState<MemberData | null>(null);
  const [loading, setLoading] = useState(false);
  const enterTimer = useRef<ReturnType<typeof setTimeout>>();
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLSpanElement>(null);

  const [type, ...idParts] = participantId.split(":");
  const entityId = idParts.join(":");
  const isAgent = type === "agent";

  const fetchData = useCallback(async () => {
    if (data || loading) return;
    setLoading(true);
    try {
      if (isAgent) {
        const res = await fetch(`/api/agents/${entityId}`);
        if (res.ok) {
          const json = await res.json();
          const a = json.agent;
          setData({
            type: "agent",
            name: a.name,
            description: a.description || undefined,
            capabilities: a.capabilities,
            created_at: a.created_at,
            created_by: a.created_by,
            last_seen_at: a.last_seen_at,
          });
        }
      } else {
        const res = await fetch("/api/users");
        if (res.ok) {
          const json = await res.json();
          const u = (json.users ?? []).find((u: { id: string }) => u.id === entityId);
          if (u) {
            setData({
              type: "human",
              name: u.name,
              description: u.description || undefined,
              created_at: u.created_at,
              invited_by: u.invited_by,
              team_role: u.team_role,
            });
          }
        }
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [data, loading, isAgent, entityId]);

  const handleEnter = () => {
    clearTimeout(leaveTimer.current);
    enterTimer.current = setTimeout(() => {
      setVisible(true);
      fetchData();
    }, 400);
  };

  const handleLeave = () => {
    clearTimeout(enterTimer.current);
    leaveTimer.current = setTimeout(() => setVisible(false), 200);
  };

  useEffect(() => {
    return () => {
      clearTimeout(enterTimer.current);
      clearTimeout(leaveTimer.current);
    };
  }, []);

  return (
    <span
      ref={containerRef}
      className="relative inline-flex"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}
      {visible && (
        <div
          className="absolute left-0 top-full z-50 mt-1.5 w-64 rounded-lg border border-border bg-background shadow-lg"
          onMouseEnter={() => clearTimeout(leaveTimer.current)}
          onMouseLeave={handleLeave}
        >
          {loading && !data ? (
            <div className="p-4 text-xs text-muted-foreground animate-pulse">
              {t("common.loading")}
            </div>
          ) : data ? (
            <div className="p-3">
              {/* Header: avatar + name */}
              <div className="flex items-center gap-3 mb-2">
                <MemberAvatar type={data.type} name={data.name} size={40} />
                <div className="min-w-0">
                  <Link
                    href={memberUrl(participantId)}
                    className="text-sm font-semibold hover:underline block truncate"
                  >
                    {data.type === "agent" ? `@${data.name}` : data.name}
                  </Link>
                  <span className="text-[10px] text-muted-foreground">
                    {data.type === "agent" ? t("members.agent") : t("members.human")}
                    {data.team_role === "owner" && ` · ${t("members.owner")}`}
                  </span>
                </div>
              </div>

              {/* Tags */}
              {data.capabilities && data.capabilities.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {data.capabilities.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex h-5 items-center rounded bg-blue-100 dark:bg-blue-900/30 px-1.5 text-[10px] font-medium text-blue-700 dark:text-blue-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Description */}
              {data.description && (
                <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                  {data.description}
                </p>
              )}

              {/* Meta */}
              <div className="border-t border-border pt-2 space-y-1">
                {data.created_by && (
                  <div className="text-[11px] text-muted-foreground">
                    {t("members.hiredBy")}{" "}
                    <Link
                      href={memberUrl(`human:${data.created_by.id}`)}
                      className="font-medium hover:underline text-foreground"
                    >
                      {data.created_by.name}
                    </Link>
                  </div>
                )}
                {data.invited_by && (
                  <div className="text-[11px] text-muted-foreground">
                    {t("members.invitedBy")}{" "}
                    <Link
                      href={memberUrl(`human:${data.invited_by.id}`)}
                      className="font-medium hover:underline text-foreground"
                    >
                      {data.invited_by.name}
                    </Link>
                  </div>
                )}
                {data.created_at && (
                  <div className="text-[11px] text-muted-foreground">
                    {t("members.joined")} {new Date(data.created_at).toLocaleDateString()}
                  </div>
                )}
                {data.last_seen_at && (
                  <div className="text-[11px] text-muted-foreground">
                    {t("members.seen").replace("{time}", timeAgo(data.last_seen_at))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </span>
  );
}
