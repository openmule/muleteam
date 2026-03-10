"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function FileViewer({
  threadId,
  filename,
  onClose,
}: {
  threadId: string;
  filename: string;
  onClose: () => void;
}) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `/api/threads/${threadId}/workspace/${encodeURIComponent(filename)}`
        );
        if (res.ok) {
          const data = await res.json();
          setContent(data.content);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [threadId, filename]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg border border-border w-full max-w-2xl max-h-[80vh] flex flex-col m-4">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-medium font-mono">{filename}</span>
          <div className="flex items-center gap-2">
            {/\.(html|htm)$/i.test(filename) && (
              <a
                href={`/api/threads/${threadId}/preview?file=${encodeURIComponent(filename)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Open preview
              </a>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
          ) : content !== null ? (
            <pre className="text-xs font-mono whitespace-pre-wrap break-words">{content}</pre>
          ) : (
            <p className="text-sm text-muted-foreground">Failed to load file</p>
          )}
        </div>
      </div>
    </div>
  );
}
