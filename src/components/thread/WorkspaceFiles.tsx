"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { FileViewer } from "./FileViewer";

interface WorkspaceFile {
  name: string;
  size: number;
  modified: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}kb`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}mb`;
}

const RENDERABLE_RE = /\.(html|htm|md|mdx|markdown)$/i;

export function WorkspaceFiles({
  threadId,
  files,
  onRefresh,
  readOnly = false,
  onOpenPageViewer,
}: {
  threadId: string;
  files: WorkspaceFile[];
  onRefresh: () => void;
  readOnly?: boolean;
  onOpenPageViewer?: (filename: string) => void;
}) {
  const t = useT();
  const [expanded, setExpanded] = useState(true);
  const [viewingFile, setViewingFile] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(selectedFiles)) {
        const content = await file.text();
        await fetch(`/api/threads/${threadId}/workspace/${encodeURIComponent(file.name)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
      }
      onRefresh();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const isHtml = (name: string) => /\.(html|htm)$/i.test(name);

  return (
    <div className="border-b border-border">
      <button
        className="flex items-center justify-between w-full px-4 py-3 text-left text-sm font-medium hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
          {t("sidebar.files")}
          {files.length > 0 && (
            <span className="text-xs text-muted-foreground font-normal">
              ({files.length} · {formatSize(files.reduce((sum, f) => sum + f.size, 0))})
            </span>
          )}
        </span>
        <span className="text-xs text-muted-foreground">{expanded ? "\u25B4" : "\u25BE"}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-1">
          {files.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">{t("sidebar.noFiles")}</p>
          )}
          {files.map((file) => (
            <div
              key={file.name}
              className="flex items-center justify-between py-1 group"
            >
              <button
                className="flex items-center gap-2 text-sm hover:underline truncate"
                onClick={() => setViewingFile(file.name)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                <span className="truncate">{file.name}</span>
              </button>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground">{formatSize(file.size)}</span>
                {RENDERABLE_RE.test(file.name) && onOpenPageViewer && (
                  <button
                    className="text-xs text-primary hover:text-primary/80 font-medium"
                    onClick={(e) => { e.stopPropagation(); onOpenPageViewer(file.name); }}
                  >
                    Open
                  </button>
                )}
              </div>
            </div>
          ))}

          {!readOnly && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".html,.htm,.md,.mdx,.markdown,.txt,.json,.css,.js,.ts,.tsx,.jsx,.yaml,.yml,.xml,.csv"
                className="hidden"
                onChange={handleFileSelect}
              />
              <button
                className="text-xs text-muted-foreground hover:text-foreground mt-1"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? "Uploading..." : t("sidebar.uploadFile")}
              </button>
            </>
          )}
        </div>
      )}

      {viewingFile && (
        <FileViewer
          threadId={threadId}
          filename={viewingFile}
          onClose={() => setViewingFile(null)}
        />
      )}
    </div>
  );
}
