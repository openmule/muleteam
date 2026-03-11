"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

export function WorkspaceFiles({
  threadId,
  files,
  onRefresh,
  readOnly = false,
}: {
  threadId: string;
  files: WorkspaceFile[];
  onRefresh: () => void;
  readOnly?: boolean;
}) {
  const t = useT();
  const [expanded, setExpanded] = useState(true);
  const [viewingFile, setViewingFile] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadContent, setUploadContent] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!uploadName.trim() || !uploadContent.trim()) return;
    setUploading(true);
    try {
      await fetch(`/api/threads/${threadId}/workspace/${encodeURIComponent(uploadName.trim())}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: uploadContent }),
      });
      setUploadName("");
      setUploadContent("");
      setShowUpload(false);
      onRefresh();
    } finally {
      setUploading(false);
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
                {isHtml(file.name) && (
                  <a
                    href={`/api/threads/${threadId}/preview?file=${encodeURIComponent(file.name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {t("common.preview")}
                  </a>
                )}
              </div>
            </div>
          ))}

          {!readOnly && (showUpload ? (
            <div className="mt-2 space-y-2 rounded-md border border-border p-3">
              <Input
                placeholder={t("thread.placeholder.filename")}
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                className="text-sm h-8"
              />
              <Textarea
                placeholder={t("thread.fileContent")}
                value={uploadContent}
                onChange={(e) => setUploadContent(e.target.value)}
                rows={4}
                className="text-xs font-mono"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleUpload} disabled={uploading || !uploadName.trim()}>
                  {uploading ? "..." : t("common.save")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowUpload(false)}>
                  {t("common.cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <button
              className="text-xs text-muted-foreground hover:text-foreground mt-1"
              onClick={() => setShowUpload(true)}
            >
              {t("sidebar.uploadFile")}
            </button>
          ))}
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
