"use client";

import { useState, useEffect, useCallback } from "react";

interface GitLogEntry {
  hash: string;
  short_hash: string;
  author: string;
  date: string;
  message: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function GitHistory({ threadId }: { threadId: string }) {
  const [expanded, setExpanded] = useState(true);
  const [log, setLog] = useState<GitLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLog = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/threads/${threadId}/git-log`);
      if (res.ok) {
        const data = await res.json();
        setLog(data.log ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    fetchLog();
    // Refresh git log every 10s
    const interval = setInterval(fetchLog, 10000);
    return () => clearInterval(interval);
  }, [fetchLog]);

  return (
    <div className="border-b border-border">
      <button
        className="flex items-center justify-between w-full px-4 py-3 text-left text-sm font-medium hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <line x1="12" y1="3" x2="12" y2="9"/>
            <line x1="12" y1="15" x2="12" y2="21"/>
          </svg>
          Git History
        </span>
        <span className="text-xs text-muted-foreground">{expanded ? "\u25B4" : "\u25BE"}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-3">
          {loading && log.length === 0 && (
            <p className="text-xs text-muted-foreground py-2 animate-pulse">Loading...</p>
          )}
          {!loading && log.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">No commits yet</p>
          )}
          {log.length > 0 && (
            <div className="space-y-0">
              {log.map((entry, i) => (
                <div key={entry.hash} className="flex gap-3 text-xs">
                  {/* Timeline */}
                  <div className="flex flex-col items-center shrink-0 w-4">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 ${i === 0 ? "bg-foreground" : "bg-muted-foreground/50"}`} />
                    {i < log.length - 1 && <div className="w-px flex-1 bg-border" />}
                  </div>
                  {/* Content */}
                  <div className="pb-3 min-w-0 flex-1">
                    <p className="text-foreground/90 truncate leading-snug">{entry.message}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 text-muted-foreground">
                      <code className="font-mono text-[10px] bg-muted px-1 rounded">{entry.short_hash}</code>
                      <span>{entry.author}</span>
                      <span>&middot;</span>
                      <span>{timeAgo(entry.date)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
